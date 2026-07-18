# 🧵 Fabric Stash

A little iPhone-friendly app for cataloging a fabric stash — every fabric's
attributes, how many yards are on hand, photos, and project ideas based on
what's actually in the stash.

It's a **Progressive Web App (PWA)**: no App Store, no account, no server.
Everything is stored privately on the phone itself, and it works offline once
installed.

## Features

- **Catalog fabrics** with photo, type, weight, color, pattern, fiber content,
  width, storage location, and notes
- **Track yardage** — quick ±¼-yard buttons on each fabric for when some gets
  used; low-yardage fabrics are flagged in red
- **Search, filter & sort** the stash by type, color, name, or yardage
- **💡 Project ideas** — for each fabric, suggestions of what there's enough
  yardage to make (t-shirt, quilt, maxi dress…), plus "almost enough" ideas
  that are within a yard of possible
- **Backup & restore** — export the whole stash to a JSON file and import it
  on a new phone
- **Offline-first** — a service worker caches the app; photos and data live in
  the browser's IndexedDB

## Putting it on an iPhone

1. Enable **GitHub Pages**: repo **Settings → Pages → Build and deployment
   → Source: GitHub Actions**. The included workflow
   (`.github/workflows/pages.yml`) deploys automatically on every push to
   `main`. (Note: Pages requires the repo to be public, or a paid plan for
   private repos.)
2. On the iPhone, open <https://alantgoff.github.io/fabrics/> in **Safari**.
3. Tap the **Share** button → **Add to Home Screen**.
4. Done — it launches full-screen like a native app, works offline, and
   picks up new versions automatically.

> **Tip:** since data lives on the device, use **More → Export stash** once in
> a while to save a backup file.

## Development

No build step, no dependencies. To run locally:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

### Layout

| Path | Purpose |
|---|---|
| `index.html` | App shell — all views (stash, add/edit, detail, ideas, settings) |
| `js/app.js` | UI logic and event wiring |
| `js/db.js` | IndexedDB storage wrapper |
| `js/ideas.js` | Fabric type list + rule-based project suggestion engine |
| `sw.js` | Service worker for offline caching |
| `manifest.webmanifest` | PWA manifest (name, icons, standalone display) |

Project ideas are simple rules in `js/ideas.js` — each project has rough
yardage needs and the fabric categories it suits. Easy to add more.
