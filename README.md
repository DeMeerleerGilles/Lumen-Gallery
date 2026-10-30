# Lumen Gallery

> Turn a folder of photos into a beautiful, self-hosted gallery.

Lumen Gallery watches a local photo folder, organizes images into albums, creates
web-friendly versions, reads available camera metadata, and serves everything
through a responsive gallery. It is designed for personal archives, family
sharing, trips, and small client galleries.

## What you get

- **Automatic albums** — subfolders become albums without importing or tagging
  photos manually.
- **Fast browsing** — thumbnails and responsive WebP images are generated
  automatically.
- **Photo details** — camera, lens, aperture, shutter speed, ISO, date taken,
  and GPS coordinates are shown when they are present in EXIF data.
- **Simple lightbox** — open a photo full-screen and inspect its metadata.
- **Self-hosted storage** — your originals stay in your own mounted photo
  directory.
- **Resilient scanning** — unreadable folders or damaged images are skipped and
  logged rather than stopping the entire gallery.

## Quick start with Docker

### 1. Download the project

```sh
git clone https://github.com/DeMeerleerGilles/Lumen-Gallery.git
cd Lumen-Gallery
```

### 2. Create the folders used by the container

```sh
mkdir -p photos data cache
```

Put your photos inside `photos`, grouped into folders. For example:

```text
photos/
├── 2025-08-01_Italy/
│   ├── IMG_0001.jpg
│   └── IMG_0002.jpg
└── Family/
    └── birthday.png
```

Each folder containing images appears as an album. Nested folders are supported.

### 3. Start Lumen Gallery

```sh
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The first scan runs when the container starts. New, changed, and deleted images
are picked up automatically while the container is running.

To stop the gallery:

```sh
docker compose down
```

## Configuration

Copy `.env.example` to `.env` when you want to customize the local setup:

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
| `ACCENT_COLOR` | `#d9a86c` | Six-digit hex color for buttons and highlights |

The Docker Compose setup already maps these locations to persistent folders:

- `./photos` → original images, mounted read-only
- `./data` → SQLite database
- `./cache` → generated thumbnails and WebP files

Do not delete `data` or `cache` unless you want to rebuild the gallery database
and generated image variants.

## Local development

Use Node.js 22 or newer. Native dependencies used by SQLite and image processing
may require your operating system's build tools.

```sh
npm install
npm run dev
```

The local development server uses `photos`, `data`, and `cache` in the project
directory by default. For a production-style local run:

```sh
npm run build
npm start
```

You can run a one-time scan without starting the web server:

```sh
npm run scan
```

## Troubleshooting

### Albums are empty

Check that:

1. Images are inside the configured photos directory.
2. The files use a supported extension: `.jpg`, `.jpeg`, `.png`, `.webp`,
   `.avif`, `.tif`, or `.tiff`.
3. The container can read the mounted directory.

View scanner output with:

```sh
docker compose logs -f lumen-gallery
```

### I changed an image but still see the old version

The browser may be caching the generated image. Refresh the page. If the issue
continues, stop the container, remove the relevant files from `cache`, and start
it again:

```sh
docker compose down
rm -rf cache/*
docker compose up -d
```

### I need to rebuild everything

The database contains indexed album and photo metadata. To rebuild both the
database and generated images:

```sh
docker compose down
rm -rf data/* cache/*
docker compose up -d
```

Your originals in `photos` are not affected by these commands.

## Personalize your view

Select **Customize** in the top-right corner of any page to choose:

- Dark or light theme
- Spacious or compact gallery spacing
- Whether file names appear below photos

These preferences are saved in your browser and do not change the gallery for
other visitors. The sun button next to **Customize** is a quick theme switch.

## Privacy notes

Lumen Gallery is self-hosted, but it does not currently provide authentication
or album-level access control. Keep the service on a trusted network, or place
it behind your own reverse proxy and authentication layer before exposing it to
the public internet.

GPS coordinates can be included in photo metadata and may be displayed by the
gallery. Remove sensitive EXIF data from originals before sharing them if
location privacy matters.

## Project structure

| Path | Purpose |
| --- | --- |
| [`src/scanner.ts`](./src/scanner.ts) | Finds images, extracts EXIF, and creates variants |
| [`src/database.ts`](./src/database.ts) | Stores album and photo metadata in SQLite |
| [`src/server.ts`](./src/server.ts) | Serves the gallery and generated media |
| [`src/main.ts`](./src/main.ts) | Starts the server, watcher, and periodic scanner |
| [`public/assets/`](./public/assets/) | Gallery styling and lightbox behavior |
| [`docker-compose.yml`](./docker-compose.yml) | Recommended Docker deployment |

## License

See [LICENSE](./LICENSE).
