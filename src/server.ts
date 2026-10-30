import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { getAlbum, listAlbums } from './database.js';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const mediaUrl = (value: string) => `/media/${value.split('/').map(encodeURIComponent).join('/')}`;
const page = (title: string, content: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · ${escapeHtml(config.siteTitle)}</title><link rel="stylesheet" href="/assets/style.css"><style>:root{--accent:${config.accentColor}}</style></head><body><header><a href="/"><strong>${escapeHtml(config.siteTitle)}</strong></a><div class="header-actions"><button class="icon-button" id="theme-toggle" type="button" aria-label="Switch theme">☼</button><button class="settings-button" id="settings-toggle" type="button">Customize</button></div></header><dialog class="settings-dialog" id="settings"><form method="dialog"><button class="close" aria-label="Close">×</button><p class="eyebrow">YOUR VIEW</p><h2>Customize the gallery</h2><label>Theme<select id="theme-choice"><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Gallery density<select id="density-choice"><option value="spacious">Spacious</option><option value="compact">Compact</option></select></label><label class="check-label"><input id="labels-choice" type="checkbox" checked> Show file names</label><button class="save-settings" value="save">Done</button></form></dialog><main>${content}</main><script src="/assets/app.js" defer></script></body></html>`;

export function createServer() {
  const app = Fastify({ logger: true });
  app.register(fastifyStatic, { root: config.cacheDir, prefix: '/media/' });
  app.register(fastifyStatic, { root: path.resolve('public/assets'), prefix: '/assets/', decorateReply: false });
  app.get('/', async (_request, reply) => {
    const albums = listAlbums();
    const cards = albums.map((album) => `<a class="album" href="/album/${encodeURIComponent(album.relativePath)}">${album.coverPath ? `<img loading="lazy" src="${mediaUrl(album.coverPath)}" alt="">` : ''}<div><h2>${escapeHtml(album.name)}</h2><span>${album.photoCount} photo${album.photoCount === 1 ? '' : 's'}</span></div></a>`).join('');
    const [taglineLead, taglineEmphasis = ''] = config.siteTagline.split(', ', 2);
    return reply.type('text/html').send(page('Albums', `<section class="hero"><p class="eyebrow">YOUR PHOTO ARCHIVE</p><h1>${escapeHtml(taglineLead)}${taglineEmphasis ? `<br><em>${escapeHtml(taglineEmphasis)}.</em>` : ''}</h1><p>${albums.length} album${albums.length === 1 ? '' : 's'} ready to explore.</p></section><section class="albums">${cards || '<p class="empty">No photos found yet. Add images to your mounted photos directory.</p>'}</section>`));
  });
  app.get<{ Params: { '*': string } }>('/album/*', async (request, reply) => {
    const relativePath = decodeURIComponent(request.params['*']);
    const result = getAlbum(relativePath);
    if (!result) return reply.code(404).send(page('Not found', '<p class="empty">Album not found.</p>'));
    const photos = result.photos.map((photo, index) => {
      const orientation = photo.height > photo.width * 1.15 ? 'portrait' : photo.width > photo.height * 1.35 ? 'landscape' : 'square';
      const size = index % 7 === 0 || (index % 7 === 4 && orientation === 'landscape') ? 'featured' : 'standard';
      return `<button class="photo ${orientation} ${size}" data-large="${mediaUrl(photo.largePath)}" data-filename="${escapeHtml(photo.filename)}" data-meta="${escapeHtml(JSON.stringify(photo.metadata))}"><img loading="lazy" src="${mediaUrl(photo.mediumPath)}" alt="${escapeHtml(photo.filename)}"><span>${escapeHtml(photo.filename)}</span></button>`;
    }).join('');
    return reply.type('text/html').send(page(result.album.name, `<a class="back" href="/">← All albums</a><div class="album-heading"><div><p class="eyebrow">ALBUM</p><h1>${escapeHtml(result.album.name)}</h1></div><span>${result.album.photoCount} photos</span></div><section class="gallery">${photos}</section><dialog id="lightbox"><button class="close" aria-label="Close">×</button><img id="lightbox-image" alt=""><aside><h3 id="lightbox-filename"></h3><dl id="lightbox-meta"></dl></aside></dialog>`));
  });
  return app;
}
