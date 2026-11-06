# Lumen Gallery

> Turn a folder of photos into a beautiful, modern, self-hosted gallery.

Lumen Gallery watches a local photo folder, organizes images into albums, creates
web-friendly versions, reads camera metadata, and serves everything
through a responsive, luminous gallery. It is designed for personal archives, family
sharing, trips, and client proofing.

---

## ✨ Features

- **Modern Aesthetic with Luminous Gradients** — Ambient glow meshes, frosted glassmorphism panels, and multi-stop brand gradients in Obsidian Dark and Porcelain Light themes.
- **Interactive Travel Maps** — Explore photos on an interactive Leaflet map with glowing pins and thumbnail previews.
- **Offline Reverse Geocoding** — Automatically translates GPS coordinates into cities and countries (e.g., *Palermo, Italy*) with zero external API calls.
- **Client Proofing & Selection Tray** — Favorite photos with a heart icon, review selections in a floating dock, copy comma-separated filenames to the clipboard for photographers, or download selected photos directly.
- **One-Click ZIP Downloads** — Stream full albums or client-selected photos as compressed `.zip` archives.
- **Pro Lightbox & Slideshow** — Fullscreen mode, automatic slideshow playback (Space), filmstrip thumbnail carousel, touch gestures, and collapsible EXIF HUD.
- **Folder Stories via `album.md`** — Drop an optional `album.md`, `album.yaml`, or `album.json` into any photo directory to set custom titles, cover photos, editorial stories, tags, and custom sort order without touching a database.
- **Instant Blur-Up Loading** — Tiny base64 placeholders and dominant color backdrops prevent layout shift.
- **Live Search & Camera Filters** — Filter in real-time by search query, camera model, or favorites, with instant sorting by date or filename.
- **Self-Hosted & Non-Destructive** — Originals stay strictly read-only in your mounted directory.

---

## 🚀 Quick start with Docker

### 1. Download the project

```sh
git clone https://github.com/DeMeerleerGilles/Lumen-Gallery.git
cd Lumen-Gallery
```

### 2. Create folders and add photos

```sh
mkdir -p photos data cache
```

Organize your photos inside `photos`:

```text
photos/
├── 2025_Italy/
│   ├── album.md             <-- Optional: title, story, custom cover
│   ├── IMG_0001.jpg
│   └── IMG_0002.jpg
└── Family/
    └── birthday.jpg
```

### 3. Start Lumen Gallery

```sh
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📝 Customizing an Album with `album.md`

You can place an optional `album.md` file in any album folder:

```markdown
---
title: "Summer in Tuscany"
description: "A breathtaking road trip through Florence, Siena, and the rolling hills of Val d'Orcia."
cover: IMG_0042.jpg
tags: italy, travel, summer
---

Optional long-form editorial intro text about the trip...
```

Lumen automatically displays the editorial intro above the gallery and uses `cover` as the album thumbnail.

---

## ⚙️ Configuration

Copy `.env.example` to `.env` when you want to customize the setup:

```sh
cp .env.example .env
```

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port used by the web server |
| `PHOTOS_DIR` | `/photos` in Docker | Directory containing original photos |
| `DATA_DIR` | `/data` in Docker | Directory containing the SQLite database |
| `CACHE_DIR` | `/cache` in Docker | Directory containing generated image variants |
| `SCAN_INTERVAL_MS` | `300000` | Periodic scan interval in milliseconds |
| `IMAGE_QUALITY` | `82` | WebP quality from 1 to 100 |
| `SITE_TITLE` | `Lumen Gallery` | Title displayed in the gallery |
| `SITE_TAGLINE` | `Every memory, beautifully arranged.` | Hero message shown on the home page |
| `ACCENT_COLOR` | `#d9a86c` | Hex color for buttons and highlights |
| `ENABLE_DOWNLOADS` | `true` | Allow full-album and selected-photo ZIP downloads |
| `ENABLE_MAP` | `true` | Enable interactive Leaflet travel maps |
| `ENABLE_PROOFING` | `true` | Enable favorites selection and client proofing tray |
| `ADMIN_PASSWORD` | unset | Optional password for the `/admin` panel using HTTP Basic Auth |

The `/admin` panel manages the gallery name, opening line, accent colour, downloads, maps, and
proofing. Managed settings are persisted in `data/gallery-settings.json` and override the
corresponding environment defaults. Set `ADMIN_PASSWORD` before exposing the gallery beyond a
trusted local network.

---

## 💻 Local Development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

For production builds:

```sh
npm run build
npm start
```

Run a one-time media scan:

```sh
npm run scan
```

---

## 📄 License

See [LICENSE](./LICENSE).
