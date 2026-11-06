import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';
import type { Album, AlbumConfig, ExifMetadata, Photo } from './types.js';

fs.mkdirSync(config.dataDir, { recursive: true });
const db = new Database(path.join(config.dataDir, 'gallery.db'));
db.pragma('journal_mode = WAL');

// Initial tables
db.exec(`
  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    relative_path TEXT NOT NULL UNIQUE,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY,
    album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    relative_path TEXT NOT NULL UNIQUE,
    thumb_path TEXT NOT NULL,
    medium_path TEXT NOT NULL,
    large_path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    modified_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS photos_album_idx ON photos(album_id);
`);

// Safe migrations for new columns
function addColumnIfNotExists(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

// Album columns
addColumnIfNotExists('albums', 'custom_title', 'TEXT');
addColumnIfNotExists('albums', 'description', 'TEXT');
addColumnIfNotExists('albums', 'cover_photo_path', 'TEXT');
addColumnIfNotExists('albums', 'date_start', 'TEXT');
addColumnIfNotExists('albums', 'date_end', 'TEXT');
addColumnIfNotExists('albums', 'locations', "TEXT DEFAULT '[]'");
addColumnIfNotExists('albums', 'tags', "TEXT DEFAULT '[]'");
addColumnIfNotExists('albums', 'sort_order', "TEXT DEFAULT 'name-asc'");
addColumnIfNotExists('albums', 'is_hidden', 'INTEGER DEFAULT 0');

// Photo columns
addColumnIfNotExists('photos', 'file_size', 'INTEGER DEFAULT 0');
addColumnIfNotExists('photos', 'media_type', "TEXT DEFAULT 'image'");
addColumnIfNotExists('photos', 'blur_placeholder', 'TEXT');
addColumnIfNotExists('photos', 'dominant_color', 'TEXT');

export function upsertAlbum(name: string, relativePath: string, albumConfig?: AlbumConfig): number {
  const customTitle = albumConfig?.title?.trim() || null;
  const description = albumConfig?.description?.trim() || null;
  const sortOrder = albumConfig?.sort || 'name-asc';
  const isHidden = albumConfig?.hidden ? 1 : 0;
  const tags = JSON.stringify(albumConfig?.tags || []);

  db.prepare(`
    INSERT INTO albums (name, relative_path, custom_title, description, sort_order, is_hidden, tags, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(relative_path) DO UPDATE SET
      name = excluded.name,
      custom_title = COALESCE(excluded.custom_title, albums.custom_title),
      description = COALESCE(excluded.description, albums.description),
      sort_order = COALESCE(excluded.sort_order, albums.sort_order),
      is_hidden = excluded.is_hidden,
      tags = excluded.tags,
      updated_at = excluded.updated_at
  `).run(name, relativePath, customTitle, description, sortOrder, isHidden, tags, Date.now());

  return (db.prepare('SELECT id FROM albums WHERE relative_path = ?').get(relativePath) as { id: number }).id;
}

export function setAlbumExplicitCover(albumId: number, coverPath: string): void {
  db.prepare('UPDATE albums SET cover_photo_path = ? WHERE id = ?').run(coverPath, albumId);
}

export function upsertPhoto(photo: Omit<Photo, 'id'>, modifiedAt: number): void {
  db.prepare(`
    INSERT INTO photos (
      album_id, filename, relative_path, thumb_path, medium_path, large_path,
      width, height, file_size, media_type, blur_placeholder, dominant_color, metadata, modified_at
    )
    VALUES (
      @albumId, @filename, @relativePath, @thumbPath, @mediumPath, @largePath,
      @width, @height, @fileSize, @mediaType, @blurPlaceholder, @dominantColor, @metadata, @modifiedAt
    )
    ON CONFLICT(relative_path) DO UPDATE SET
      album_id = excluded.album_id,
      filename = excluded.filename,
      thumb_path = excluded.thumb_path,
      medium_path = excluded.medium_path,
      large_path = excluded.large_path,
      width = excluded.width,
      height = excluded.height,
      file_size = excluded.file_size,
      media_type = excluded.media_type,
      blur_placeholder = excluded.blur_placeholder,
      dominant_color = excluded.dominant_color,
      metadata = excluded.metadata,
      modified_at = excluded.modified_at
  `).run({
    ...photo,
    metadata: JSON.stringify(photo.metadata),
    modifiedAt
  });
}

/**
 * Aggregates date ranges and discovered locations for each album.
 */
export function recalculateAlbumStats(): void {
  const albums = db.prepare('SELECT id FROM albums').all() as Array<{ id: number }>;

  for (const { id } of albums) {
    const photos = db.prepare('SELECT metadata FROM photos WHERE album_id = ?').all(id) as Array<{ metadata: string }>;
    const dates: string[] = [];
    const locationsSet = new Set<string>();

    for (const p of photos) {
      try {
        const meta = JSON.parse(p.metadata) as ExifMetadata;
        if (meta.dateTaken) dates.push(meta.dateTaken);
        if (meta.city && meta.country) {
          locationsSet.add(`${meta.city}, ${meta.country}`);
        } else if (meta.country) {
          locationsSet.add(meta.country);
        }
      } catch {
        // ignore invalid JSON
      }
    }

    dates.sort();
    const dateStart = dates[0] || null;
    const dateEnd = dates[dates.length - 1] || null;
    const locations = JSON.stringify(Array.from(locationsSet));

    db.prepare(`
      UPDATE albums
      SET date_start = ?, date_end = ?, locations = ?
      WHERE id = ?
    `).run(dateStart, dateEnd, locations, id);
  }
}

export function removeMissingPhotos(seenPaths: Set<string>): void {
  const rows = db.prepare('SELECT relative_path FROM photos').all() as { relative_path: string }[];
  const remove = db.prepare('DELETE FROM photos WHERE relative_path = ?');
  const transaction = db.transaction(() => {
    rows.filter((row) => !seenPaths.has(row.relative_path)).forEach((row) => remove.run(row.relative_path));
  });
  transaction();
  db.prepare('DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM photos)').run();
  recalculateAlbumStats();
}

export function listAlbums(includeHidden = false): Album[] {
  const query = `
    SELECT
      a.id,
      a.name,
      a.custom_title AS title,
      a.description,
      a.relative_path AS relativePath,
      a.date_start AS dateStart,
      a.date_end AS dateEnd,
      a.locations,
      a.tags,
      COUNT(p.id) AS photoCount,
      COALESCE(
        a.cover_photo_path,
        (SELECT thumb_path FROM photos WHERE album_id = a.id ORDER BY filename LIMIT 1)
      ) AS coverPath
    FROM albums a
    LEFT JOIN photos p ON p.album_id = a.id
    ${includeHidden ? '' : 'WHERE a.is_hidden = 0'}
    GROUP BY a.id
    ORDER BY a.relative_path
  `;

  const rows = db.prepare(query).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    title: (row.title as string) || (row.name as string),
    description: (row.description as string) || undefined,
    relativePath: row.relativePath as string,
    photoCount: row.photoCount as number,
    coverPath: (row.coverPath as string) || undefined,
    dateStart: (row.dateStart as string) || undefined,
    dateEnd: (row.dateEnd as string) || undefined,
    locations: row.locations ? JSON.parse(row.locations as string) : [],
    tags: row.tags ? JSON.parse(row.tags as string) : []
  }));
}

export function getAlbum(relativePath: string): { album: Album; photos: Photo[] } | undefined {
  const albumRow = db.prepare(`
    SELECT
      a.id,
      a.name,
      a.custom_title AS title,
      a.description,
      a.relative_path AS relativePath,
      a.date_start AS dateStart,
      a.date_end AS dateEnd,
      a.locations,
      a.tags,
      a.sort_order AS sortOrder,
      COUNT(p.id) AS photoCount,
      COALESCE(
        a.cover_photo_path,
        (SELECT thumb_path FROM photos WHERE album_id = a.id ORDER BY filename LIMIT 1)
      ) AS coverPath
    FROM albums a
    LEFT JOIN photos p ON p.album_id = a.id
    WHERE a.relative_path = ?
    GROUP BY a.id
  `).get(relativePath) as Record<string, unknown> | undefined;

  if (!albumRow) return undefined;

  const album: Album = {
    id: albumRow.id as number,
    name: albumRow.name as string,
    title: (albumRow.title as string) || (albumRow.name as string),
    description: (albumRow.description as string) || undefined,
    relativePath: albumRow.relativePath as string,
    photoCount: albumRow.photoCount as number,
    coverPath: (albumRow.coverPath as string) || undefined,
    dateStart: (albumRow.dateStart as string) || undefined,
    dateEnd: (albumRow.dateEnd as string) || undefined,
    locations: albumRow.locations ? JSON.parse(albumRow.locations as string) : [],
    tags: albumRow.tags ? JSON.parse(albumRow.tags as string) : []
  };

  const rows = db.prepare('SELECT * FROM photos WHERE album_id = ? ORDER BY filename').all(album.id) as Array<Record<string, unknown>>;

  const photos = rows.map((row) => ({
    id: row.id as number,
    albumId: row.album_id as number,
    filename: row.filename as string,
    relativePath: row.relative_path as string,
    thumbPath: row.thumb_path as string,
    mediumPath: row.medium_path as string,
    largePath: row.large_path as string,
    width: row.width as number,
    height: row.height as number,
    fileSize: (row.file_size as number) || 0,
    mediaType: ((row.media_type as string) || 'image') as 'image' | 'video',
    blurPlaceholder: (row.blur_placeholder as string) || undefined,
    dominantColor: (row.dominant_color as string) || undefined,
    metadata: JSON.parse((row.metadata as string) || '{}') as ExifMetadata
  }));

  return { album, photos };
}

export function getPhotosByFilenames(albumRelativePath: string, filenames: string[]): Array<{ filename: string; filePath: string }> {
  const result = getAlbum(albumRelativePath);
  if (!result) return [];

  const filenameSet = new Set(filenames);
  return result.photos
    .filter((p) => filenameSet.has(p.filename))
    .map((p) => ({
      filename: p.filename,
      filePath: path.join(config.photosDir, p.relativePath)
    }));
}
