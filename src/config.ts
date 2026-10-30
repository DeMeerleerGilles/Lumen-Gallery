import 'dotenv/config';
import path from 'node:path';

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function color(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

export const config = {
  port: positiveInt(process.env.PORT, 3000),
  photosDir: path.resolve(process.env.PHOTOS_DIR ?? './photos'),
  dataDir: path.resolve(process.env.DATA_DIR ?? './data'),
  cacheDir: path.resolve(process.env.CACHE_DIR ?? './cache'),
  scanIntervalMs: positiveInt(process.env.SCAN_INTERVAL_MS, 300_000),
  imageQuality: Math.min(100, Math.max(1, positiveInt(process.env.IMAGE_QUALITY, 82))),
  siteTitle: process.env.SITE_TITLE?.trim() || 'Lumen Gallery',
  siteTagline: process.env.SITE_TAGLINE?.trim() || 'Every memory, beautifully arranged.',
  accentColor: color(process.env.ACCENT_COLOR, '#d9a86c')
};
