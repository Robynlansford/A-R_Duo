/* ============================================================
   A&R — RED RITUAL engine
   Canvas scrub film (ImageBitmap sliding window), beat overlays,
   ritual HUD, adaptive chrome, ember ambient layer, WebGL psy
   background, tilt cards, reveals, marquee drift, dev contract.
   ============================================================ */
(() => {
  "use strict";

  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOBILE = matchMedia("(max-width: 720px)").matches;
  const JUMP = new URLSearchParams(location.search).get("jump");
  if (JUMP !== null) history.scrollRestoration = "manual";

  /* ---------------- shared: cursor ---------------- */
  const cursor = document.querySelector(".cursor");
  if (cursor && !REDUCED) {
    let live = false;
    addEventListener("mousemove", e => {
      if (!live) { live = true; cursor.classList.add("live"); }
      cursor.style.transform = `translate(${e.clientX - 7}px, ${e.clientY - 7}px)`;
    }, { passive: true });
    document.querySelectorAll("a, button, .record, .member").forEach(el => {
      el.addEventListener("mouseenter", () => cursor.classList.add("hot"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("hot"));
    });
  }

  /* ---------------- shared: reveals ---------------- */
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add("lit"); io.unobserve(e.target); }
  }, { threshold: .16 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));

  /* ---------------- shared: tilt cards ---------------- */
  if (!REDUCED && matchMedia("(hover: hover)").matches) {
    document.querySelectorAll("[data-tilt]").forEach(card => {
      let raf = 0;
      card.addEventListener("mousemove", e => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - .5;
          const y = (e.clientY - r.top) / r.height - .5;
          card.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
        });
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg)";
        card.style.transition = "transform .6s cubic-bezier(.16,1,.3,1)";
        setTimeout(() => card.style.transition = "", 620);
      });
    });
  }

  /* ---------------- shared: marquee drift + velocity skew ---------------- */
  const marquees = document.querySelectorAll(".marquee .row");
  let lastY = scrollY, vel = 0;
  if (marquees.length && !REDUCED) {
    let off = 0;
    (function driftLoop() {
      vel += ((scrollY - lastY) - vel) * .12; lastY = scrollY;
      off -= .55 + Math.min(3.4, Math.abs(vel) * .05);
      for (const row of marquees) {
        const half = row.scrollWidth / 2;
        if (-off > half) off += half;
        row.style.transform = `translateX(${off}px) skewX(${Math.max(-9, Math.min(9, vel * .16))}deg)`;
      }
      requestAnimationFrame(driftLoop);
    })();
  }

  /* ============================================================
     FILM — only on pages with #ritualDriver
     ============================================================ */
  const driver = document.getElementById("ritualDriver");
  const world = document.querySelector("main.world");

  /* psy WebGL background (runs on every page that has #psy) */
  initPsy();

  if (!driver) {
    const bar0 = document.querySelector(".bar");
    bar0 && bar0.classList.add("scrim");
    window.__ready = true;
    return;
  }

  const stage = document.getElementById("stage");
  const filmCanvas = document.getElementById("film");
  const fxCanvas = document.getElementById("fx");
  const loader = document.getElementById("loader");
  const loaderFill = loader && loader.querySelector(".fill");
  const loaderPct = loader && loader.querySelector(".pct");
  const fadeOut = stage.querySelector(".fade-out");
  const grain = stage.querySelector(".grain");
  const vignette = stage.querySelector(".vignette");
  const bar = document.querySelector(".bar");
  const hud = document.getElementById("hud");
  const hudChap = hud && hud.querySelector(".chap");
  const hudIdx = hud && hud.querySelector(".idx");
  const hudFill = hud && hud.querySelector(".fill");
  const freqBars = hud ? Array.from(hud.querySelectorAll(".freq i")) : [];

  const ctx = filmCanvas.getContext("2d");
  const fx = fxCanvas.getContext("2d");

  const CHAPTERS = ["THE SIGIL", "THE THRESHOLD", "THE INSTRUMENT", "THE STAGE", "TRANSCENDENCE", "THE MARK"];

  /* driver height: ~170vh per chapter (a touch shorter on mobile) */
  const PER_VH = MOBILE ? 135 : 172;
  driver.style.height = (CHAPTERS.length * PER_VH) + "vh";

  let vw = 0, vh = 0, dpr = 1;
  function sizeCanvases() {
    if (innerWidth < 2 || innerHeight < 2) { setTimeout(sizeCanvases, 120); return; }
    vw = innerWidth; vh = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    for (const c of [filmCanvas, fxCanvas]) {
      c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr);
      c.style.width = vw + "px"; c.style.height = vh + "px";
    }
    if (displayed >= 0) drawFrame(displayed, true);
  }

  /* ---------------- frame store ---------------- */
  let FRAME_COUNT = 0, PREFIX = "frames/f_", PAD = 4, SEAM = "#070304";
  const images = [], bitmaps = new Map(), decoding = new Set();
  const B_AHEAD = 24, B_KEEP = 36;
  let bmpCenter = -999, displayed = -1, loadedCount = 0;
  const frameSrc = i => PREFIX + String(i).padStart(PAD, "0") + ".jpg";

  function pump() {
    const CONC = 11;
    let next = 0, inFlight = 0;
    return new Promise(resolve => {
      (function fill() {
        while (inFlight < CONC && next < FRAME_COUNT) {
          const i = next++;
          const im = new Image();
          inFlight++;
          im.onload = im.onerror = () => {
            inFlight--; loadedCount++;
            if (loaderFill) {
              const p = loadedCount / FRAME_COUNT;
              loaderFill.style.transform = `scaleX(${p})`;
              if (loaderPct) loaderPct.textContent = String(Math.round(p * 100)).padStart(3, "0") + " / SIGNAL";
            }
            if (loadedCount === FRAME_COUNT) resolve(); else fill();
          };
          im.src = frameSrc(i);
          images[i] = im;
        }
      })();
    });
  }

  function ensureBitmaps(center) {
    if (Math.abs(center - bmpCenter) < 3) return;
    bmpCenter = center;
    const lo = Math.max(0, center - B_AHEAD), hi = Math.min(FRAME_COUNT - 1, center + B_AHEAD);
    for (let i = lo; i <= hi; i++) {
      if (bitmaps.has(i) || decoding.has(i) || !images[i] || !images[i].complete || !images[i].naturalWidth) continue;
      decoding.add(i);
      createImageBitmap(images[i]).then(b => {
        decoding.delete(i);
        if (Math.abs(i - bmpCenter) > B_KEEP) { b.close(); return; }
        bitmaps.set(i, b);
        if (i === displayed) drawFrame(i, true);
      }).catch(() => decoding.delete(i));
    }
    for (const k of Array.from(bitmaps.keys()))
      if (k < center - B_KEEP || k > center + B_KEEP) { bitmaps.get(k).close(); bitmaps.delete(k); }
  }

  function nearestLoaded(idx) {
    if (images[idx] && images[idx].complete && images[idx].naturalWidth) return idx;
    for (let d = 1; d < FRAME_COUNT; d++) {
      const a = idx - d, b = idx + d;
      if (a >= 0 && images[a] && images[a].complete && images[a].naturalWidth) return a;
      if (b < FRAME_COUNT && images[b] && images[b].complete && images[b].naturalWidth) return b;
    }
    return -1;
  }

  function drawFrame(idx, force) {
    if (idx === displayed && !force) return;
    const bm = bitmaps.get(idx);
    const src = bm || images[nearestLoaded(idx)];
    if (!src) return;
    displayed = idx;
    const sw = bm ? bm.width : src.naturalWidth, sh = bm ? bm.height : src.naturalHeight;
    const cw = filmCanvas.width, ch = filmCanvas.height;
    const s = Math.max(cw / sw, ch / sh), dw = sw * s, dh = sh * s;
    ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  /* ---------------- ember ambient layer (hero only) ---------------- */
  const emberSprite = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const g = c.getContext("2d");
    const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, "rgba(255,220,190,1)");
    rg.addColorStop(.35, "rgba(255,106,77,.85)");
    rg.addColorStop(1, "rgba(255,36,56,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
    return c;
  })();
  const EMBERS = MOBILE ? 34 : 70;
  const embers = [];
  for (let i = 0; i < EMBERS; i++) {
    embers.push({
      x: Math.random(), y: Math.random(),
      s: .5 + Math.random() * 1.6, v: .00022 + Math.random() * .00055,
      drift: (Math.random() - .5) * .00035, ph: Math.random() * Math.PI * 2
    });
  }
  function drawEmbers(t, alpha) {
    fx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    if (alpha <= 0 || REDUCED) return;
    fx.save(); fx.scale(dpr, dpr);
    for (const e of embers) {
      e.y -= e.v * 16; e.x += e.drift * 16;
      if (e.y < -.03) { e.y = 1.03; e.x = Math.random(); }
      if (e.x < -.03) e.x = 1.03; if (e.x > 1.03) e.x = -.03;
      const tw = .55 + .45 * Math.sin(e.ph + t * .0022);
      const s = e.s * 7 * tw + 2;
      fx.globalAlpha = alpha * tw * .8;
      fx.drawImage(emberSprite, e.x * vw - s / 2, e.y * vh - s / 2, s, s);
    }
    fx.restore();
  }

  /* ---------------- beats ---------------- */
  const beats = Array.from(document.querySelectorAll(".beat")).map(el => ({
    el,
    in: parseFloat(el.dataset.in),
    peak: parseFloat(el.dataset.peak),
    out: parseFloat(el.dataset.out)
  }));
  function beatAlpha(b, p) {
    if (p < b.in || p > b.out) return 0;
    if (p < b.peak) return (p - b.in) / Math.max(1e-4, b.peak - b.in);
    if (b.out > 1.5) return 1;
    return 1 - (p - b.peak) / Math.max(1e-4, b.out - b.peak);
  }
  let scrollDir = 1, lastScrollForDir = 0;
  function updateBeats(p) {
    for (const b of beats) {
      const a = beatAlpha(b, p);
      b.el.style.opacity = a.toFixed(3);
      b.el.style.pointerEvents = a > .6 && b.out > 1.5 ? "auto" : "none";
      if (!b.el.classList.contains("hero") && !b.el.classList.contains("finale")) {
        const shift = (1 - a) * 26 * scrollDir;
        const baseY = b.el.classList.contains("left") || b.el.classList.contains("right") ? "-50%" : "0px";
        b.el.style.transform = `translateY(calc(${baseY} + ${shift.toFixed(1)}px))`;
      }
    }
  }

  /* ---------------- HUD ---------------- */
  let freqPhase = 0;
  function updateHud(p) {
    if (!hud) return;
    if (p > .015 && p < .997) hud.classList.add("live"); else hud.classList.remove("live");
    const ci = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length));
    if (hudChap && hudChap.textContent !== CHAPTERS[ci]) hudChap.textContent = CHAPTERS[ci];
    if (hudIdx) hudIdx.textContent = "0" + (ci + 1) + " / 0" + CHAPTERS.length;
    if (hudFill) hudFill.style.height = (p * 100).toFixed(1) + "%";
    freqPhase += .16 + Math.min(.5, Math.abs(vel) * .01);
    freqBars.forEach((el, i) => {
      const h = 4 + Math.abs(Math.sin(freqPhase + i * .9)) * 14 * (.4 + Math.min(1, Math.abs(vel) * .02 + p));
      el.style.height = h.toFixed(1) + "px";
    });
  }

  /* ---------------- adaptive chrome ---------------- */
  const lumCanvas = document.createElement("canvas");
  lumCanvas.width = 16; lumCanvas.height = 4;
  const lumCtx = lumCanvas.getContext("2d", { willReadFrequently: true });
  let lastLum = 0;
  function sampleChrome(now) {
    if (now - lastLum < 180 || displayed < 0) return;
    lastLum = now;
    try {
      lumCtx.drawImage(filmCanvas, 0, 0, filmCanvas.width, Math.max(1, filmCanvas.height * .12), 0, 0, 16, 4);
      const d = lumCtx.getImageData(0, 0, 16, 4).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
      const lum = sum / (d.length / 4);
      const onLight = lum > 138;
      bar && bar.classList.toggle("on-light", onLight);
      hud && hud.classList.toggle("on-light", onLight);
    } catch (_) { /* canvas tainted or zero-size — skip */ }
  }

  /* ---------------- scroll → progress ---------------- */
  let progress = 0;
  function computeProgress() {
    const r = driver.getBoundingClientRect();
    progress = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - vh)));
    return progress;
  }

  /* ---------------- main tick ---------------- */
  let current = 0, target = 0, running = false, lastT = 0;
  const psyState = { filmDone: 0 };
  /* jank meter */
  let jMax = 0, jLast = 0, jT = 0;

  function tick(t) {
    if (jLast) { const d = t - jLast; if (d > jMax) jMax = d; }
    jLast = t;
    if (t - jT > 2000) { jT = t; if (jMax > 0) { window.__jankMax = Math.max(window.__jankMax || 0, jMax); } jMax = 0; }

    const p = computeProgress();
    scrollDir = scrollY >= lastScrollForDir ? 1 : -1; lastScrollForDir = scrollY;

    target = p * (FRAME_COUNT - 1);
    current += (target - current) * .14;
    if (Math.abs(target - current) < .5) current = target;
    const frame = Math.round(current);
    ensureBitmaps(frame);
    drawFrame(frame);

    /* embers fade out across first 7% */
    const emberAlpha = Math.max(0, 1 - p / .07);
    drawEmbers(t, emberAlpha);

    /* end-of-film fades */
    const endRamp = Math.max(0, (p - .93) / .07);
    if (fadeOut) fadeOut.style.opacity = endRamp.toFixed(3);
    if (grain) grain.style.opacity = (.5 * (1 - endRamp * .8)).toFixed(3);
    if (vignette) vignette.style.opacity = (1 - endRamp * .6).toFixed(3);
    psyState.filmDone = endRamp;

    updateBeats(p);
    updateHud(p);
    sampleChrome(t);
    bar && bar.classList.toggle("scrim", p > .995);

    running = true;
    requestAnimationFrame(tick);
  }

  /* ---------------- boot ---------------- */
  fetch("frames/manifest.json")
    .then(r => r.json())
    .then(m => {
      FRAME_COUNT = m.count;
      PREFIX = m.prefix || PREFIX;
      PAD = m.pad || PAD;
      SEAM = m.seam || SEAM;
      document.documentElement.style.setProperty("--seam", SEAM);
      sizeCanvases();
      addEventListener("resize", sizeCanvases);
      return pump();
    })
    .then(() => {
      ensureBitmaps(0);
      const start = () => {
        if (loader) loader.classList.add("gone");
        const settle = () => {
          const p = computeProgress();
          current = target = p * (FRAME_COUNT - 1);
          ensureBitmaps(Math.round(current));
          drawFrame(Math.round(current), true);
          updateBeats(p); updateHud(p);
        };
        if (JUMP !== null) {
          const ty = +JUMP || 0;
          let tries = 0;
          (function apply() {
            scrollTo(0, ty); settle();
            if (Math.abs(scrollY - ty) > 2 && tries++ < 20) { setTimeout(apply, 60); return; }
            if (!running) requestAnimationFrame(tick);
            setTimeout(() => { settle(); markReady(); }, 220);
          })();
        } else {
          settle();
          if (!running) requestAnimationFrame(tick);
          setTimeout(markReady, 220);
        }
      };
      /* tiny beat of black before the sigil fades in */
      setTimeout(start, 160);
    })
    .catch(err => {
      console.error("[ritual] film unavailable:", err);
      if (loader) loader.classList.add("gone");
      driver.style.height = "100vh";
      markReady();
    });

  function markReady() { window.__ready = true; }

  /* ============================================================
     PSY — WebGL liquid-kaleidoscope background for the content
     world. Subtle, paused when offscreen, skipped on reduce.
     ============================================================ */
  function initPsy() {
    const psy = document.getElementById("psy");
    if (!psy || REDUCED) return;
    const gl = psy.getContext("webgl", { alpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return;

    const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
    const FS = `
precision mediump float;
uniform vec2 R; uniform float T; uniform float A; uniform vec2 C;
/* red/black liquid marble with a soft 6-fold kaleidoscope breath */
float n(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float smoothNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(n(i), n(i + vec2(1., 0.)), f.x),
             mix(n(i + vec2(0., 1.)), n(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++){ v += a * smoothNoise(p); p = p * 2.04 + 17.7; a *= .52; }
  return v;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * R) / min(R.x, R.y) - C;
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  /* gentle kaleidoscope fold */
  float seg = 3.14159265 / 3.;
  float fold = abs(mod(ang, seg * 2.) - seg);
  vec2 kuv = vec2(cos(fold), sin(fold)) * r;
  float t = T * .045;
  float m = fbm(kuv * 2.6 + vec2(t * .7, -t * .5) + fbm(kuv * 3.1 - t) * 1.4);
  float veins = smoothstep(.42, .5, m) - smoothstep(.5, .62, m);
  vec3 blood = vec3(1.0, .14, .20);
  vec3 ember = vec3(1.0, .58, .32);
  vec3 col = blood * m * 1.15 + ember * veins * 1.6;
  col *= smoothstep(1.25, .25, r);           /* vignette to black */
  gl_FragColor = vec4(col, A * (m * .5 + veins * .5));
}`;
    function sh(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    const vs = sh(gl.VERTEX_SHADER, VS), fs2 = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs2) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs2); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const locA = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(locA);
    gl.vertexAttribPointer(locA, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, "R");
    const uT = gl.getUniformLocation(prog, "T");
    const uA = gl.getUniformLocation(prog, "A");
    const uC = gl.getUniformLocation(prog, "C");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    function sizePsy() {
      const d = Math.min(devicePixelRatio || 1, 1);
      psy.width = Math.round(innerWidth * d * .75);
      psy.height = Math.round(innerHeight * d * .75);
      gl.viewport(0, 0, psy.width, psy.height);
    }
    sizePsy();
    addEventListener("resize", sizePsy);

    /* warm the pipeline once at boot so the first visible draw can't spike */
    gl.uniform2f(uR, psy.width, psy.height);
    gl.uniform1f(uT, 0);
    gl.uniform1f(uA, 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();

    /* visible only while content world is on screen */
    let worldVisible = !driver; /* pages without a film: always on */
    if (world && driver) {
      new IntersectionObserver(es => {
        for (const e of es) worldVisible = e.isIntersecting;
      }, { rootMargin: "10% 0px" }).observe(world);
    }

    /* re-center the effect on the footer emblem while the footer is on screen.
       rect is only re-measured on scroll/resize (not every frame) — calling
       getBoundingClientRect() per rAF tick forces layout every frame, which is
       expensive on a tall content-visibility:auto page. */
    const footerEl = document.querySelector("footer.crypt .wings") || document.querySelector("footer.crypt");
    let footerVisible = false, targetX = 0, targetY = 0, targetDirty = true;
    if (footerEl) {
      new IntersectionObserver(es => {
        for (const e of es) footerVisible = e.isIntersecting;
        targetDirty = true;
      }, { rootMargin: "0px" }).observe(footerEl);
      addEventListener("scroll", () => { targetDirty = true; }, { passive: true });
      addEventListener("resize", () => { targetDirty = true; }, { passive: true });
    }

    function measureTarget() {
      targetDirty = false;
      if (!footerVisible || !footerEl) { targetX = 0; targetY = 0; return; }
      const rect = footerEl.getBoundingClientRect();
      const px = rect.left + rect.width * .5, py = rect.top + rect.height * .5;
      const canvasX = px * (psy.width / innerWidth);
      const canvasY = psy.height - py * (psy.height / innerHeight);
      const m = Math.min(psy.width, psy.height);
      targetX = (canvasX - .5 * psy.width) / m;
      targetY = (canvasY - .5 * psy.height) / m;
    }

    let alpha = 0, cx = 0, cy = 0;
    (function psyLoop(t) {
      requestAnimationFrame(psyLoop);
      const want = worldVisible ? .42 : 0;
      alpha += (want - alpha) * .04;
      if (alpha < .004) { if (psy.style.opacity !== "0") psy.style.opacity = "0"; return; }
      psy.style.opacity = "1";

      if (targetDirty) measureTarget();
      cx += (targetX - cx) * .06;
      cy += (targetY - cy) * .06;

      gl.uniform2f(uR, psy.width, psy.height);
      gl.uniform1f(uT, t * .001);
      gl.uniform1f(uA, alpha);
      gl.uniform2f(uC, cx, cy);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    })(0);
  }
})();
