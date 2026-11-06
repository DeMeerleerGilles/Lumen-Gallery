import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config, getManagedSettings, updateManagedSettings } from './config.js';
import { getAlbum, getPhotosByFilenames, listAlbums } from './database.js';
import { createZipArchive } from './zip.js';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

const mediaUrl = (value: string) => `/media/${value.split('/').map(encodeURIComponent).join('/')}`;

function renderHtmlPage(title: string, content: string, extraScripts = '') {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · ${escapeHtml(config.siteTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <link rel="stylesheet" href="/assets/style.css">
  <style>
    :root {
      --accent: ${config.accentColor};
    }
  </style>
</head>
<body>
  <header class="glass-header">
    <div class="header-inner">
      <a class="brand" href="/">
        <span class="brand-sparkle">✦</span>
        <span class="brand-name">${escapeHtml(config.siteTitle)}</span>
      </a>

      <div class="header-actions">
        <div class="quick-search">
          <input type="text" id="global-search" placeholder="Search gallery..." aria-label="Search">
        </div>
        <button class="icon-btn theme-toggle" id="theme-toggle" type="button" title="Toggle theme">
          <span class="theme-icon">◐</span>
        </button>
        <button class="btn btn-glass" id="settings-toggle" type="button">
          <span>Customize</span>
        </button>
        <a class="admin-link" href="/admin">Admin</a>
      </div>
    </div>
  </header>

  <dialog class="custom-dialog" id="settings">
    <div class="dialog-content">
      <div class="dialog-header">
        <p class="dialog-eyebrow">PREFERENCES</p>
        <h2>Customize Gallery</h2>
        <button class="close-btn" id="close-settings" aria-label="Close">×</button>
      </div>
      <form method="dialog" class="dialog-form">
        <div class="field">
          <label for="theme-choice">Color Theme</label>
          <select id="theme-choice">
            <option value="dark">Obsidian Dark (Glow)</option>
            <option value="light">Porcelain Light (Clean)</option>
          </select>
        </div>
        <div class="field">
          <label for="density-choice">Gallery Grid Density</label>
          <select id="density-choice">
            <option value="spacious">Spacious (Showcase)</option>
            <option value="compact">Compact (High density)</option>
            <option value="masonry">Natural Aspect (Editorial)</option>
          </select>
        </div>
        <div class="field-checkbox">
          <label class="toggle-container">
            <input id="labels-choice" type="checkbox" checked>
            <span class="toggle-switch"></span>
            <span class="toggle-label">Display filenames in gallery view</span>
          </label>
        </div>
        <div class="field-checkbox">
          <label class="toggle-container">
            <input id="gps-choice" type="checkbox" checked>
            <span class="toggle-switch"></span>
            <span class="toggle-label">Show GPS location badges</span>
          </label>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-primary" value="save">Apply & Close</button>
        </div>
      </form>
    </div>
  </dialog>

  <main class="page-container">
    ${content}
  </main>

  <div id="toast-container" class="toast-container" aria-live="polite"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="/assets/app.js" defer></script>
  ${extraScripts}
</body>
</html>`;
}

export function createServer() {
  const app = Fastify({ logger: false });

  const isAdminAuthorized = (request: { headers: Record<string, string | string[] | undefined> }) => {
    if (!config.adminPassword) return true;
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Basic ')) return false;
    try {
      const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
      return decoded === `admin:${config.adminPassword}`;
    } catch {
      return false;
    }
  };

  app.register(fastifyStatic, { root: config.cacheDir, prefix: '/media/' });
  app.register(fastifyStatic, { root: path.resolve('public/assets'), prefix: '/assets/', decorateReply: false });

  app.get('/admin', async (request, reply) => {
    if (!isAdminAuthorized(request)) {
      return reply.header('WWW-Authenticate', 'Basic realm="Lumen Gallery Admin"').code(401).send('Authentication required');
    }
    const settings = getManagedSettings();
    const content = `
      <section class="admin-page">
        <div class="admin-intro">
          <a class="back-link" href="/">← Back to gallery</a>
          <p class="admin-kicker">GALLERY CONTROL ROOM</p>
          <h1 class="admin-title">Shape the room.</h1>
          <p class="admin-lead">A small set of decisions for how your archive is presented. Changes apply to the gallery immediately.</p>
        </div>
        <form class="admin-form" id="admin-settings-form">
          <div class="admin-section">
            <p class="admin-section-label">Identity</p>
            <div class="admin-fields">
              <label class="field"><span>Gallery name</span><input name="siteTitle" value="${escapeHtml(settings.siteTitle)}" maxlength="100" required></label>
              <label class="field"><span>Opening line</span><input name="siteTagline" value="${escapeHtml(settings.siteTagline)}" maxlength="180" required></label>
              <label class="field admin-color-field"><span>Accent colour</span><input name="accentColor" type="color" value="${escapeHtml(settings.accentColor)}"></label>
            </div>
          </div>
          <div class="admin-section">
            <p class="admin-section-label">Visibility</p>
            <div class="admin-fields admin-toggles">
              <label class="admin-toggle"><input name="enableDownloads" type="checkbox" ${settings.enableDownloads ? 'checked' : ''}><span><strong>Downloads</strong><small>Allow album and selection ZIPs.</small></span></label>
              <label class="admin-toggle"><input name="enableMap" type="checkbox" ${settings.enableMap ? 'checked' : ''}><span><strong>Maps</strong><small>Show location-based photo maps.</small></span></label>
              <label class="admin-toggle"><input name="enableProofing" type="checkbox" ${settings.enableProofing ? 'checked' : ''}><span><strong>Proofing</strong><small>Keep favorites and selection tools available.</small></span></label>
            </div>
          </div>
          <div class="admin-actions"><button class="btn btn-primary" type="submit">Save changes <span aria-hidden="true">↗</span></button><span id="admin-status" role="status"></span></div>
        </form>
      </section>
    `;
    const adminScript = `<script>
      document.getElementById('admin-settings-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries());
        data.enableDownloads = form.enableDownloads.checked;
        data.enableMap = form.enableMap.checked;
        data.enableProofing = form.enableProofing.checked;
        const status = document.getElementById('admin-status');
        try {
          const response = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
          if (!response.ok) throw new Error('Unable to save settings');
          status.textContent = 'Saved. The gallery is updated.';
        } catch (error) {
          status.textContent = error.message;
        }
      });
    </script>`;
    return reply.type('text/html').send(renderHtmlPage('Admin', content, adminScript));
  });

  app.put<{ Body: Record<string, unknown> }>('/api/admin/settings', async (request, reply) => {
    if (!isAdminAuthorized(request)) return reply.code(401).send({ error: 'Authentication required' });
    try {
      const settings = updateManagedSettings({
        siteTitle: typeof request.body?.siteTitle === 'string' ? request.body.siteTitle : undefined,
        siteTagline: typeof request.body?.siteTagline === 'string' ? request.body.siteTagline : undefined,
        accentColor: typeof request.body?.accentColor === 'string' ? request.body.accentColor : undefined,
        enableDownloads: request.body?.enableDownloads === true,
        enableMap: request.body?.enableMap === true,
        enableProofing: request.body?.enableProofing === true
      });
      return reply.send({ settings });
    } catch (error) {
      request.log.error(error, 'Failed to update gallery settings');
      return reply.code(500).send({ error: 'Unable to save gallery settings' });
    }
  });

  // Home Page
  app.get('/', async (_request, reply) => {
    const albums = listAlbums();
    const totalPhotos = albums.reduce((sum, a) => sum + a.photoCount, 0);

    // Collect unique visited locations across all albums
    const allLocations = Array.from(new Set(albums.flatMap((a) => a.locations || [])));

    const albumCards = albums
      .map((album) => {
        const locationsBadges = (album.locations || [])
          .slice(0, 2)
          .map((loc) => `<span class="badge badge-subtle">📍 ${escapeHtml(loc)}</span>`)
          .join('');

        const dateBadge = album.dateStart ? `<span class="badge badge-glass">📅 ${escapeHtml(album.dateStart.slice(0, 7))}</span>` : '';

        return `
        <a class="album-card" href="/album/${encodeURIComponent(album.relativePath)}">
          <div class="album-cover-wrap">
            ${
              album.coverPath
                ? `<img loading="lazy" src="${mediaUrl(album.coverPath)}" alt="${escapeHtml(album.title || album.name)}" class="album-cover">`
                : `<div class="album-cover-placeholder"><span>✦</span></div>`
            }
            <div class="album-cover-overlay"></div>
            <div class="album-badges">
              <span class="badge badge-accent">${album.photoCount} photo${album.photoCount === 1 ? '' : 's'}</span>
              ${dateBadge}
            </div>
          </div>
          <div class="album-info">
            <h3 class="album-title">${escapeHtml(album.title || album.name)}</h3>
            ${locationsBadges ? `<div class="album-meta-pills">${locationsBadges}</div>` : ''}
            ${album.description ? `<p class="album-snippet">${escapeHtml(album.description.slice(0, 100))}${album.description.length > 100 ? '…' : ''}</p>` : ''}
          </div>
        </a>
      `;
      })
      .join('');

    const [taglineLead, taglineEmphasis = ''] = config.siteTagline.split(', ', 2);
    const heroAlbum = albums.find((album) => album.coverPath);

    const content = `
      <section class="hero-section">
        <div class="hero-copy">
          <div class="hero-eyebrow-wrap">
            <span class="hero-pill">YOUR PRIVATE PHOTO ARCHIVE</span>
          </div>
          <h1 class="hero-heading">
            ${escapeHtml(taglineLead)}
            ${taglineEmphasis ? `<br><span class="gradient-text">${escapeHtml(taglineEmphasis)}.</span>` : ''}
          </h1>
          <p class="hero-lead">A quiet place for the people, places, and small details worth keeping.</p>
          <div class="hero-stats-row">
            <div class="hero-stat">
              <span class="stat-number">${albums.length}</span>
              <span class="stat-label">Album${albums.length === 1 ? '' : 's'}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="hero-stat">
              <span class="stat-number">${totalPhotos}</span>
              <span class="stat-label">Photographs</span>
            </div>
            ${
              allLocations.length > 0
                ? `
              <div class="stat-divider"></div>
              <div class="hero-stat">
                <span class="stat-number">${allLocations.length}</span>
                <span class="stat-label">Places</span>
              </div>
            `
                : ''
            }
          </div>
        </div>
        ${
          heroAlbum?.coverPath
            ? `
          <a class="hero-photo" href="/album/${encodeURIComponent(heroAlbum.relativePath)}" aria-label="Open ${escapeHtml(heroAlbum.title || heroAlbum.name)}">
            <img src="${mediaUrl(heroAlbum.coverPath)}" alt="${escapeHtml(heroAlbum.title || heroAlbum.name)}">
            <span class="hero-photo-mark">OPEN FEATURED ALBUM <span aria-hidden="true">↗</span></span>
          </a>
        `
            : ''
        }
      </section>

      <section class="albums-section">
        <div class="section-toolbar">
          <div class="section-title-wrap">
            <h2 class="section-title">All Albums</h2>
            <p class="section-subtitle">Synced directly from your storage</p>
          </div>
        </div>
        <div class="albums-grid">
          ${albumCards || `<div class="empty-state"><div class="empty-icon">📁</div><p class="empty-text">No photos found yet. Place your image folders into the mounted photos directory.</p></div>`}
        </div>
      </section>
    `;

    return reply.type('text/html').send(renderHtmlPage('Albums', content));
  });

  // Album Page
  app.get<{ Params: { '*': string } }>('/album/*', async (request, reply) => {
    const relativePath = decodeURIComponent(request.params['*']);
    const result = getAlbum(relativePath);

    if (!result) {
      return reply.code(404).send(
        renderHtmlPage(
          'Not found',
          `
          <div class="empty-state">
            <h2>Album not found</h2>
            <p>The requested album directory does not exist or has been removed.</p>
            <a class="btn btn-primary" href="/">← Return Home</a>
          </div>
        `
        )
      );
    }

    const { album, photos } = result;

    // Determine unique cameras and locations for filters
    const cameras = Array.from(new Set(photos.map((p) => p.metadata.camera).filter(Boolean))) as string[];
    const photosWithGps = config.enableMap
      ? photos.filter((p) => typeof p.metadata.latitude === 'number' && typeof p.metadata.longitude === 'number')
      : [];

    const photosJson = JSON.stringify(
      photos.map((p) => ({
        id: p.id,
        filename: p.filename,
        largeUrl: mediaUrl(p.largePath),
        mediumUrl: mediaUrl(p.mediumPath),
        thumbUrl: mediaUrl(p.thumbPath),
        width: p.width,
        height: p.height,
        mediaType: p.mediaType,
        dominantColor: p.dominantColor,
        metadata: p.metadata
      }))
    );

    const photoCards = photos
      .map((photo, index) => {
        const aspect = photo.width && photo.height ? (photo.width / photo.height).toFixed(3) : '1.0';
        const orientation = photo.height > photo.width * 1.15 ? 'portrait' : photo.width > photo.height * 1.35 ? 'landscape' : 'square';
        const isFeatured = index % 11 === 0 ? 'featured' : '';
        const hasGps = typeof photo.metadata.latitude === 'number' && typeof photo.metadata.longitude === 'number';

        const specsBadge = [photo.metadata.aperture, photo.metadata.shutterSpeed, photo.metadata.iso ? `ISO ${photo.metadata.iso}` : '']
          .filter(Boolean)
          .join(' · ');

        const locationLabel = photo.metadata.city ? `${photo.metadata.city}, ${photo.metadata.country || ''}` : photo.metadata.country || '';

        return `
        <div class="photo-card ${orientation} ${isFeatured}"
             data-index="${index}"
             data-filename="${escapeHtml(photo.filename)}"
             data-camera="${escapeHtml(photo.metadata.camera || '')}"
             data-date="${escapeHtml(photo.metadata.dateTaken || '')}"
             data-has-gps="${hasGps ? 'true' : 'false'}"
             data-aspect="${aspect}"
             style="--aspect: ${aspect}; --dominant: ${photo.dominantColor || 'rgba(255,255,255,0.05)'}">
          <button class="photo-click-target" type="button" aria-label="Open ${escapeHtml(photo.filename)} in lightbox">
            <div class="img-wrapper">
              ${
                photo.blurPlaceholder
                  ? `<div class="blur-placeholder" style="background-image: url('${photo.blurPlaceholder}')"></div>`
                  : `<div class="color-placeholder" style="background-color: ${photo.dominantColor || '#1a1c23'}"></div>`
              }
              <img loading="lazy" src="${mediaUrl(photo.mediumPath)}" alt="${escapeHtml(photo.filename)}" class="gallery-img">
            </div>
          </button>

          ${
            config.enableProofing
              ? `
            <button class="fav-btn" type="button" data-filename="${escapeHtml(photo.filename)}" aria-label="Favorite photo">
              <svg class="heart-icon" viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
          `
              : ''
          }

          <div class="photo-footer">
            <span class="photo-name">${escapeHtml(photo.filename)}</span>
            ${specsBadge ? `<span class="photo-specs">${escapeHtml(specsBadge)}</span>` : ''}
          </div>
        </div>
      `;
      })
      .join('');

    const locationsList = (album.locations || []).map((loc) => `<span class="badge badge-accent">📍 ${escapeHtml(loc)}</span>`).join('');

    const content = `
      <div class="album-page-header">
        <a class="back-link" href="/">
          <span class="back-arrow">←</span> All Albums
        </a>

        <div class="album-headline-wrap">
          <div class="album-title-group">
            <span class="album-kicker">PHOTO ALBUM</span>
            <h1 class="album-title-main">${escapeHtml(album.title || album.name)}</h1>
          </div>

          <div class="album-meta-badges">
            <span class="badge badge-glass">📸 ${album.photoCount} Photographs</span>
            ${album.dateStart ? `<span class="badge badge-glass">📅 ${escapeHtml(album.dateStart.slice(0, 10))} ${album.dateEnd && album.dateEnd !== album.dateStart ? `→ ${escapeHtml(album.dateEnd.slice(0, 10))}` : ''}</span>` : ''}
            ${locationsList}
          </div>
        </div>

        ${album.description ? `<div class="album-story-editorial"><p>${escapeHtml(album.description)}</p></div>` : ''}

        <!-- Interactive Control Bar -->
        <div class="album-toolbar glass-panel">
          <div class="toolbar-left">
            <div class="view-toggle-group">
              <button class="view-toggle-btn active" id="view-grid-btn" type="button">
                <span>⊞ Grid View</span>
              </button>
              ${
                photosWithGps.length > 0
                  ? `
                <button class="view-toggle-btn" id="view-map-btn" type="button">
                  <span>🗺️ Map View (${photosWithGps.length})</span>
                </button>
              `
                  : ''
              }
            </div>

            <div class="filter-search-wrap">
              <input type="text" id="album-filter-input" placeholder="Filter by name, camera, city..." aria-label="Filter album photos">
            </div>
          </div>

          <div class="toolbar-right">
            ${
              cameras.length > 1
                ? `
              <div class="camera-filter-wrap">
                <select id="camera-select" aria-label="Filter by camera">
                  <option value="all">All Cameras</option>
                  ${cameras.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
              </div>
            `
                : ''
            }

            <div class="sort-wrap">
              <select id="sort-select" aria-label="Sort photos">
                <option value="date-desc">Date (Newest first)</option>
                <option value="date-asc">Date (Oldest first)</option>
                <option value="name-asc">Filename (A → Z)</option>
                <option value="name-desc">Filename (Z → A)</option>
              </select>
            </div>

            ${
              config.enableProofing
                ? `
              <button class="btn btn-outline" id="favorites-filter-toggle" type="button" title="Show only favorites">
                <span class="btn-icon">♥</span>
                <span class="fav-filter-text">Favorites</span>
              </button>
            `
                : ''
            }

            ${
              config.enableDownloads
                ? `
              <a class="btn btn-accent" href="/api/album-download/${encodeURIComponent(album.relativePath)}" title="Download album as ZIP">
                <span class="btn-icon">↓</span> Download Album
              </a>
            `
                : ''
            }
          </div>
        </div>
      </div>

      <!-- View Containers -->
      <div id="grid-view-container" class="view-container active">
        <section class="gallery-grid" id="main-gallery-grid">
          ${photoCards}
        </section>
        <div id="empty-filter-state" class="empty-state hidden">
          <p>No photos match your current filter criteria.</p>
          <button class="btn btn-glass" id="clear-filters-btn" type="button">Reset Filters</button>
        </div>
      </div>

      ${
        photosWithGps.length > 0
          ? `
        <div id="map-view-container" class="view-container hidden">
          <div id="album-map" class="album-map-canvas"></div>
        </div>
      `
          : ''
      }

      ${
        config.enableProofing
          ? `
        <!-- Client Proofing / Favorites Tray -->
        <div id="proofing-tray" class="proofing-tray hidden glass-panel">
          <div class="tray-inner">
            <div class="tray-info">
              <span class="tray-icon">♥</span>
              <span id="tray-count-text">0 selected</span>
            </div>
            <div class="tray-actions">
              <button class="btn btn-glass btn-sm" id="tray-copy-names" type="button">
                📋 Copy Filenames
              </button>
              <button class="btn btn-accent btn-sm" id="tray-download-selected" type="button">
                ↓ Download Selected
              </button>
              <button class="btn btn-subtle btn-sm" id="tray-clear" type="button">
                Clear
              </button>
            </div>
          </div>
        </div>
      `
          : ''
      }

      <!-- Pro Lightbox -->
      <dialog id="lightbox" class="pro-lightbox">
        <div class="lightbox-overlay-backdrop"></div>
        <div class="lightbox-container">
          <div class="lightbox-top-bar">
            <div class="lightbox-counter" id="lightbox-counter">1 / ${photos.length}</div>
            <div class="lightbox-top-actions">
              <button class="icon-btn lightbox-action-btn" id="lightbox-slideshow" type="button" title="Slideshow autoplay (Space)">
                ▶
              </button>
              <button class="icon-btn lightbox-action-btn" id="lightbox-fullscreen" type="button" title="Fullscreen (F)">
                ⛶
              </button>
              <button class="icon-btn lightbox-action-btn" id="lightbox-fav" type="button" title="Favorite">
                ♥
              </button>
              <a class="icon-btn lightbox-action-btn" id="lightbox-download" href="#" download title="Download Photo">
                ↓
              </a>
              <button class="icon-btn lightbox-action-btn" id="lightbox-info-toggle" type="button" title="Toggle EXIF Info (I)">
                ℹ
              </button>
              <button class="icon-btn lightbox-action-btn close-action" id="lightbox-close" type="button" title="Close (Esc)">
                ✕
              </button>
            </div>
          </div>

          <div class="lightbox-main-stage">
            <button class="lightbox-nav-btn prev" id="lightbox-prev" aria-label="Previous photo">‹</button>

            <div class="lightbox-image-stage">
              <div id="lightbox-media-wrapper" class="lightbox-media-wrapper">
                <img id="lightbox-img" src="" alt="" class="lightbox-img">
              </div>
            </div>

            <button class="lightbox-nav-btn next" id="lightbox-next" aria-label="Next photo">›</button>

            <!-- Collapsible EXIF Inspector Drawer -->
            <aside class="lightbox-inspector glass-panel" id="lightbox-inspector">
              <div class="inspector-header">
                <h3 id="inspector-filename" class="inspector-filename"></h3>
              </div>
              <div class="inspector-body">
                <div class="inspector-section">
                  <div class="spec-pills-row" id="inspector-pills"></div>
                </div>
                <dl class="inspector-meta-list" id="inspector-meta-list"></dl>
              </div>
            </aside>
          </div>

          <!-- Thumbnail Filmstrip Strip -->
          <div class="lightbox-filmstrip-bar" id="lightbox-filmstrip"></div>
        </div>
      </dialog>

      <!-- Embedded Data for Client JS -->
      <script>
        window.LUMEN_ALBUM_DATA = {
          album: ${JSON.stringify(album)},
          photos: ${photosJson}
        };
      </script>
    `;

    return reply.type('text/html').send(renderHtmlPage(album.title || album.name, content));
  });

  // Download entire album as ZIP
  app.get<{ Params: { '*': string } }>('/api/album-download/*', async (request, reply) => {
    if (!config.enableDownloads) {
      return reply.code(403).send({ error: 'Downloads are disabled by administrator.' });
    }

    const relativePath = decodeURIComponent(request.params['*']);
    const result = getAlbum(relativePath);
    if (!result || result.photos.length === 0) {
      return reply.code(404).send({ error: 'Album not found or empty' });
    }

    const filesToZip = result.photos.map((photo) => ({
      name: photo.filename,
      filePath: path.join(config.photosDir, photo.relativePath)
    }));

    try {
      const zipBuffer = await createZipArchive(filesToZip);
      const safeFilename = `${result.album.name.replace(/[^a-z0-9_-]/gi, '_')}.zip`;

      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="${safeFilename}"`)
        .header('Content-Length', zipBuffer.length)
        .send(zipBuffer);
    } catch (err) {
      request.log.error(err, 'Failed to create zip archive');
      return reply.code(500).send({ error: 'Failed to build zip archive' });
    }
  });

  // Download selected photos as ZIP
  app.post<{ Body: { albumPath: string; filenames: string[] } }>('/api/photos/download-selected', async (request, reply) => {
    if (!config.enableDownloads) {
      return reply.code(403).send({ error: 'Downloads are disabled' });
    }

    const { albumPath, filenames } = request.body || {};
    if (!albumPath || !Array.isArray(filenames) || filenames.length === 0) {
      return reply.code(400).send({ error: 'albumPath and non-empty filenames array are required' });
    }

    const matchedFiles = getPhotosByFilenames(albumPath, filenames);
    if (matchedFiles.length === 0) {
      return reply.code(404).send({ error: 'No matching files found in album' });
    }

    const filesToZip = matchedFiles.map((f) => ({
      name: f.filename,
      filePath: f.filePath
    }));

    try {
      const zipBuffer = await createZipArchive(filesToZip);
      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', 'attachment; filename="selected_photos.zip"')
        .header('Content-Length', zipBuffer.length)
        .send(zipBuffer);
    } catch (err) {
      request.log.error(err, 'Failed to build selected photos zip');
      return reply.code(500).send({ error: 'Failed to build zip archive' });
    }
  });

  return app;
}
