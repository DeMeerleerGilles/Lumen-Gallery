import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';
import { config } from './config.js';
import { recalculateAlbumStats, removeMissingPhotos, setAlbumExplicitCover, upsertAlbum, upsertPhoto } from './database.js';
import { reverseGeocode } from './geocoder.js';
import type { AlbumConfig, ExifMetadata } from './types.js';

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff']);
const videoExtensions = new Set(['.mp4', '.mov', '.webm']);
const cacheDir = config.cacheDir;

function relative(value: string): string {
  return path.relative(config.photosDir, value).split(path.sep).join('/');
}

function mediaRelative(value: string): string {
  return path.relative(cacheDir, value).split(path.sep).join('/');
}

function formatShutter(value: unknown): string | undefined {
  if (typeof value !== 'number') return undefined;
  return value >= 1 ? `${value}s` : `1/${Math.round(1 / value)}s`;
}

function formatFocal(value: unknown): string | undefined {
  if (typeof value !== 'number') return undefined;
  return `${Math.round(value)}mm`;
}

/**
 * Parses simple YAML-like frontmatter or JSON from an album metadata file.
 */
async function parseAlbumMetadataFile(dirPath: string): Promise<{ config: AlbumConfig; explicitCoverFilename?: string } | undefined> {
  const candidates = ['album.md', 'album.yaml', 'album.yml', 'album.json'];
  for (const filename of candidates) {
    const fullPath = path.join(dirPath, filename);
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      if (filename.endsWith('.json')) {
        const parsed = JSON.parse(content) as AlbumConfig;
        return { config: parsed, explicitCoverFilename: parsed.cover };
      }

      // album.md / yaml frontmatter parsing
      const albumConf: AlbumConfig = {};
      const lines = content.split('\n');
      let inFrontmatter = false;
      const bodyLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (i === 0 && line === '---') {
          inFrontmatter = true;
          continue;
        }
        if (inFrontmatter && line === '---') {
          inFrontmatter = false;
          continue;
        }

        if (inFrontmatter) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim().toLowerCase();
            const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (key === 'title') albumConf.title = val;
            else if (key === 'description') albumConf.description = val;
            else if (key === 'cover') albumConf.cover = val;
            else if (key === 'sort') albumConf.sort = val as AlbumConfig['sort'];
            else if (key === 'hidden') albumConf.hidden = val.toLowerCase() === 'true';
            else if (key === 'tags') {
              albumConf.tags = val.split(',').map((t) => t.trim()).filter(Boolean);
            }
          }
        } else {
          bodyLines.push(lines[i]);
        }
      }

      const bodyText = bodyLines.join('\n').trim();
      if (!albumConf.description && bodyText) {
        albumConf.description = bodyText;
      }

      return { config: albumConf, explicitCoverFilename: albumConf.cover };
    } catch {
      // file not found or parse error
    }
  }

  // Check for auto-detected cover image file (e.g. cover.jpg)
  const coverCandidates = ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp'];
  for (const coverName of coverCandidates) {
    try {
      await fs.access(path.join(dirPath, coverName));
      return { config: {}, explicitCoverFilename: coverName };
    } catch {
      // not found
    }
  }

  return undefined;
}

interface DiscoveredFile {
  fullPath: string;
  type: 'image' | 'video';
}

async function walk(dir: string): Promise<DiscoveredFile[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: DiscoveredFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      try {
        files.push(...(await walk(fullPath)));
      } catch (error) {
        console.warn(`Skipping unreadable folder ${fullPath}:`, error);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (imageExtensions.has(ext)) {
        files.push({ fullPath, type: 'image' });
      } else if (videoExtensions.has(ext)) {
        files.push({ fullPath, type: 'video' });
      }
    }
  }
  return files;
}

async function processPhoto(filePath: string, mediaType: 'image' | 'video'): Promise<{ albumId: number; thumbPath: string; filename: string }> {
  const relativePath = relative(filePath);
  const parsed = path.posix.parse(relativePath);
  const albumPath = parsed.dir;
  const albumFullPath = path.join(config.photosDir, albumPath);

  // Check for album metadata file
  const albumMeta = await parseAlbumMetadataFile(albumFullPath);
  const albumTitle = albumMeta?.config.title || path.basename(albumPath) || 'All photos';
  const albumId = upsertAlbum(albumTitle, albumPath, albumMeta?.config);

  const outputBase = path.join(cacheDir, albumPath, parsed.name);
  await fs.mkdir(path.dirname(outputBase), { recursive: true });

  const variants = {
    thumb: `${outputBase}-thumb.webp`,
    medium: `${outputBase}-medium.webp`,
    large: `${outputBase}-large.webp`
  };

  const stat = await fs.stat(filePath);
  let width = 0;
  let height = 0;
  let dominantColor: string | undefined;
  let blurPlaceholder: string | undefined;

  const metadata: ExifMetadata = {};

  if (mediaType === 'image') {
    const image = sharp(filePath);
    const info = await image.metadata();
    width = info.width ?? 0;
    height = info.height ?? 0;

    // Generate average dominant color & tiny blur placeholder
    try {
      const colorBuffer = await image.clone().resize(1, 1).raw().toBuffer();
      if (colorBuffer.length >= 3) {
        const r = colorBuffer[0].toString(16).padStart(2, '0');
        const g = colorBuffer[1].toString(16).padStart(2, '0');
        const b = colorBuffer[2].toString(16).padStart(2, '0');
        dominantColor = `#${r}${g}${b}`;
      }

      // 16x16 tiny base64 preview
      const tinyBuffer = await image.clone().resize(16, 16, { fit: 'inside' }).webp({ quality: 20 }).toBuffer();
      blurPlaceholder = `data:image/webp;base64,${tinyBuffer.toString('base64')}`;
    } catch (e) {
      // non-critical preview generation error
    }

    // EXIF Extraction
    const exif = (await exifr
      .parse(filePath, { tiff: true, xmp: true, gps: true, iptc: true })
      .catch(() => undefined)) as Record<string, unknown> | undefined;

    if (exif) {
      metadata.camera = [exif.Make, exif.Model].filter(Boolean).join(' ') || undefined;
      metadata.lens = typeof exif.LensModel === 'string' ? exif.LensModel : undefined;
      metadata.aperture = typeof exif.FNumber === 'number' ? `f/${exif.FNumber}` : undefined;
      metadata.shutterSpeed = formatShutter(exif.ExposureTime);
      metadata.iso = typeof exif.ISO === 'number' ? exif.ISO : undefined;
      metadata.focalLength = formatFocal(exif.FocalLength);
      metadata.dateTaken = exif.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal.toISOString() : undefined;

      if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
        metadata.latitude = exif.latitude;
        metadata.longitude = exif.longitude;

        // Offline reverse geocode
        const location = reverseGeocode(exif.latitude, exif.longitude);
        if (location) {
          metadata.city = location.city;
          metadata.country = location.country;
        }
      }

      if (width && height) {
        metadata.megapixels = `${((width * height) / 1_000_000).toFixed(1)} MP`;
      }
    }

    // Generate responsive WebP sizes
    await Promise.all([
      image.clone().resize({ width: 480, height: 480, fit: 'inside' }).webp({ quality: config.imageQuality }).toFile(variants.thumb),
      image.clone().resize({ width: 1440, height: 1440, fit: 'inside' }).webp({ quality: config.imageQuality }).toFile(variants.medium),
      image.clone().resize({ width: 2560, height: 2560, fit: 'inside' }).webp({ quality: config.imageQuality }).toFile(variants.large)
    ]);
  } else {
    // Basic video handling: create a styled video poster or thumb
    width = 1920;
    height = 1080;
    dominantColor = '#1f2937';
    // Generate fallback poster if needed
    const svgThumb = Buffer.from(`
      <svg width="480" height="360" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#13141c"/>
        <circle cx="240" cy="180" r="44" fill="#d9a86c" opacity="0.85"/>
        <polygon points="230,162 258,180 230,198" fill="#0b0c10"/>
      </svg>
    `);
    await sharp(svgThumb).webp().toFile(variants.thumb);
    await sharp(svgThumb).webp().toFile(variants.medium);
    await sharp(svgThumb).webp().toFile(variants.large);
  }

  const thumbRel = mediaRelative(variants.thumb);

  upsertPhoto(
    {
      albumId,
      filename: parsed.base,
      relativePath,
      thumbPath: thumbRel,
      mediumPath: mediaRelative(variants.medium),
      largePath: mediaRelative(variants.large),
      width,
      height,
      fileSize: stat.size,
      mediaType,
      blurPlaceholder,
      dominantColor,
      metadata
    },
    stat.mtimeMs
  );

  // If this matches an explicit cover filename, set as album cover
  if (albumMeta?.explicitCoverFilename === parsed.base) {
    setAlbumExplicitCover(albumId, thumbRel);
  }

  return { albumId, thumbPath: thumbRel, filename: parsed.base };
}

export async function scanPhotos(): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  let files: DiscoveredFile[];
  try {
    files = await walk(config.photosDir);
  } catch (error) {
    console.error(`Unable to scan ${config.photosDir}:`, error);
    return;
  }

  const seen = new Set<string>();
  for (const item of files) {
    try {
      await processPhoto(item.fullPath, item.type);
      seen.add(relative(item.fullPath));
    } catch (error) {
      console.warn(`Skipping unreadable item ${item.fullPath}:`, error);
    }
  }

  removeMissingPhotos(seen);
  recalculateAlbumStats();
  console.info(`Gallery scan complete: ${seen.size} photo/media item(s) processed.`);
}
