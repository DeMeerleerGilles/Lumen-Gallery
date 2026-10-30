import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';
import { config } from './config.js';
import { removeMissingPhotos, upsertAlbum, upsertPhoto } from './database.js';

const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff']);
const cacheDir = config.cacheDir;

function relative(value: string): string {
  return path.relative(config.photosDir, value).split(path.sep).join('/');
}

function mediaRelative(value: string): string {
  return path.relative(cacheDir, value).split(path.sep).join('/');
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      try { files.push(...await walk(fullPath)); } catch (error) {
        console.warn(`Skipping unreadable folder ${fullPath}:`, error);
      }
    } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

function formatShutter(value: unknown): string | undefined {
  if (typeof value !== 'number') return undefined;
  return value >= 1 ? `${value}s` : `1/${Math.round(1 / value)}s`;
}

async function processPhoto(filePath: string): Promise<void> {
  const relativePath = relative(filePath);
  const parsed = path.posix.parse(relativePath);
  const albumPath = parsed.dir;
  const albumId = upsertAlbum(path.basename(albumPath) || 'All photos', albumPath);
  const outputBase = path.join(cacheDir, albumPath, parsed.name);
  await fs.mkdir(path.dirname(outputBase), { recursive: true });
  const variants = { thumb: `${outputBase}-thumb.webp`, medium: `${outputBase}-medium.webp`, large: `${outputBase}-large.webp` };
  const image = sharp(filePath);
  const info = await image.metadata();
  const exif = await exifr.parse(filePath, { tiff: true, xmp: true, gps: true }).catch(() => undefined) as Record<string, unknown> | undefined;
  const metadata = {
    camera: [exif?.Make, exif?.Model].filter(Boolean).join(' ') || undefined,
    lens: typeof exif?.LensModel === 'string' ? exif.LensModel : undefined,
    aperture: typeof exif?.FNumber === 'number' ? `f/${exif.FNumber}` : undefined,
    shutterSpeed: formatShutter(exif?.ExposureTime),
    iso: typeof exif?.ISO === 'number' ? exif.ISO : undefined,
    dateTaken: exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal.toISOString() : undefined,
    latitude: typeof exif?.latitude === 'number' ? exif.latitude : undefined,
    longitude: typeof exif?.longitude === 'number' ? exif.longitude : undefined
  };
  await Promise.all([
    image.clone().resize({ width: 480, height: 480, fit: 'inside' }).webp({ quality: config.imageQuality }).toFile(variants.thumb),
    image.clone().resize({ width: 1440, height: 1440, fit: 'inside' }).webp({ quality: config.imageQuality }).toFile(variants.medium),
    image.clone().resize({ width: 2560, height: 2560, fit: 'inside' }).webp({ quality: config.imageQuality }).toFile(variants.large)
  ]);
  const stat = await fs.stat(filePath);
  upsertPhoto({
    albumId, filename: parsed.base, relativePath, thumbPath: mediaRelative(variants.thumb),
    mediumPath: mediaRelative(variants.medium), largePath: mediaRelative(variants.large),
    width: info.width ?? 0, height: info.height ?? 0, metadata
  }, stat.mtimeMs);
}

export async function scanPhotos(): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  let files: string[];
  try { files = await walk(config.photosDir); } catch (error) {
    console.error(`Unable to scan ${config.photosDir}:`, error);
    return;
  }
  const seen = new Set<string>();
  for (const file of files) {
    try { await processPhoto(file); seen.add(relative(file)); }
    catch (error) { console.warn(`Skipping unreadable image ${file}:`, error); }
  }
  removeMissingPhotos(seen);
  console.info(`Gallery scan complete: ${seen.size} image(s)`);
}
