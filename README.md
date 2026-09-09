# A&R — Red Ritual site

Static site for **A&R**, a psychedelic rock duo out of Boise, Idaho (Aaron and Robyn). HTML, CSS, and a small JS film engine. No build step, no backend.

This is the A-R Duo client site — not Boise_Ai, Ground-Truth, Opti-Part, Oasis, or Stout Jarvis.

## How to run locally

From the repo root, serve the files over HTTP (the scroll film loads frames via `fetch`; opening `index.html` as a file will fail that part).

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080/](http://localhost:8080/).

Any other static server is fine (`npx serve`, Caddy, nginx).

## How to deploy

The repo is a static root. Point any static host at it.

**GitHub Pages (default assumed in SEO tags):**

1. Repo **Settings → Pages**.
2. Source: **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`.
4. Wait for the Pages URL. Canonical / Open Graph tags currently use:

   `https://robynlansford.github.io/A-R_Duo/`

   If you add a custom domain, update that origin in every page `<head>` and in `js/site.js` (`SITE.origin`).

There is no form endpoint to configure. Contact and list requests open the visitor’s email app (`mailto:`).

## What this polish does not invent

Unpaid vs paid status is unknown. The site does **not** claim show counts, sold-out nights, live social channels, or a working CRM. Tour rows that were already in the repo are still listed; **Inquire** goes to Summon, and past calendar dates are marked **Passed**. Confirm every date and venue before you treat them as booked.

## Robyn-only blockers (before a public launch)

Set these yourself — they cannot be guessed honestly:

| Item | Where | Notes |
| --- | --- | --- |
| Booking / press inboxes | `js/site.js` (`bookingEmail`, `pressEmail`) and the `mailto:` links on `index.html` / `contact.html` | Copy still uses `summon@ar-ritual.band` and `press@ar-ritual.band`. Confirm those mailboxes exist or replace them. |
| Public phone | `js/site.js` (`phone`) and Summon | Left empty on purpose. Add a `tel:` link when you have a number you want on the site. |
| Social / stream URLs | Footer | Dead `#` icons were removed. Add Instagram, YouTube, Spotify, Bandcamp when the URLs are real. |
| Ticket vendor | Rites | Buttons say **Inquire** and go to Summon. Point them at a real ticket URL per date when you have one. |
| Public origin | `<link rel="canonical">`, `og:url`, `og:image`, `SITE.origin` | Change if Pages is not the live URL. |

## Pages

| File | Route |
| --- | --- |
| `index.html` | Home / Red Ritual film |
| `band.html` | The Duo |
| `music.html` | Sound |
| `tour.html` | Rites |
| `contact.html` | Summon |

## License

All frequencies reserved — © 2026 A&R, Boise, Idaho.
