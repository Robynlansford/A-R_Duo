/* ============================================================
   A&R — shared chrome: config, mobile nav, honest mailto forms.
   No CRM / newsletter backend is wired. Forms open the visitor's
   email app and say so. Update SITE when inboxes, phone, or the
   public origin change.
   ============================================================ */
(() => {
  "use strict";

  const SITE = {
    origin: "https://robynlansford.github.io/A-R_Duo",
    bookingEmail: "summon@ar-ritual.band",
    pressEmail: "press@ar-ritual.band",
    phone: ""
  };
  window.AR_SITE = SITE;

  /* ---------------- skip already in markup ---------------- */

  /* ---------------- mobile nav ---------------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (toggle && nav) {
    const setOpen = open => {
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open) {
        const first = nav.querySelector("a");
        first && first.focus();
      }
    };
    toggle.addEventListener("click", () => {
      setOpen(!document.body.classList.contains("nav-open"));
    });
    nav.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => setOpen(false));
    });
    addEventListener("keydown", e => {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------------- honest mailto forms ---------------- */
  function encode(s) {
    return encodeURIComponent(s == null ? "" : String(s)).replace(/%20/g, "+");
  }

  function showStatus(form, text) {
    let box = form.querySelector(".form-status");
    if (!box) {
      box = document.createElement("p");
      box.className = "form-status";
      box.setAttribute("role", "status");
      form.appendChild(box);
    }
    box.hidden = false;
    box.textContent = text;
  }

  function openMailto(to, subject, body) {
    const href = "mailto:" + to
      + "?subject=" + encode(subject)
      + "&body=" + encode(body);
    location.href = href;
  }

  document.querySelectorAll("form[data-form]").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const kind = form.getAttribute("data-form");
      const fd = new FormData(form);
      const visitor = (fd.get("email") || "").toString().trim();
      if (kind === "list") {
        const subject = "A&R — add me to the list";
        const body = [
          "Please add this address to the list when a list exists.",
          "",
          "Email: " + visitor
        ].join("\n");
        openMailto(SITE.bookingEmail, subject, body);
        showStatus(form, "No mailing list is wired on this site. Your email app should open with a short request — nothing is sent from this page. If nothing opens, write " + SITE.bookingEmail + " yourself.");
        return;
      }
      if (kind === "mailto") {
        const name = (fd.get("name") || "").toString().trim();
        const phone = (fd.get("phone") || "").toString().trim();
        const topic = (fd.get("topic") || "Message").toString().trim();
        const message = (fd.get("message") || "").toString().trim();
        const to = topic === "Press" ? SITE.pressEmail : SITE.bookingEmail;
        const subject = "A&R — " + topic;
        const body = [
          "Name: " + name,
          "Email: " + visitor,
          "Phone: " + (phone || "(not given)"),
          "Topic: " + topic,
          "",
          message
        ].join("\n");
        openMailto(to, subject, body);
        showStatus(form, "This page does not send mail by itself. Your email app should open with the message filled in. If nothing opens, write " + to + " directly.");
      }
    });
  });
})();
