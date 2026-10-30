import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';
import type { Album, ExifMetadata, Photo } from './types.js';

fs.mkdirSync(config.dataDir, { recursive: true });
const db = new Database(path.join(config.dataDir, 'gallery.db'));
db.pragma('journal_mode = WAL');
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

export function upsertAlbum(name: string, relativePath: string): number {
  db.prepare(`
    INSERT INTO albums (name, relative_path, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(relative_path) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
  `).run(name, relativePath, Date.now());
  return (db.prepare('SELECT id FROM albums WHERE relative_path = ?').get(relativePath) as { id: number }).id;
}

export function upsertPhoto(photo: Omit<Photo, 'id'>, modifiedAt: number): void {
  db.prepare(`
    INSERT INTO photos (album_id, filename, relative_path, thumb_path, medium_path, large_path, width, height, metadata, modified_at)
    VALUES (@albumId, @filename, @relativePath, @thumbPath, @mediumPath, @largePath, @width, @height, @metadata, @modifiedAt)
    ON CONFLICT(relative_path) DO UPDATE SET
      album_id = excluded.album_id, filename = excluded.filename, thumb_path = excluded.thumb_path,
      medium_path = excluded.medium_path, large_path = excluded.large_path, width = excluded.width,
      height = excluded.height, metadata = excluded.metadata, modified_at = excluded.modified_at
  `).run({ ...photo, metadata: JSON.stringify(photo.metadata), modifiedAt });
}

export function removeMissingPhotos(seenPaths: Set<string>): void {
  const rows = db.prepare('SELECT relative_path FROM photos').all() as { relative_path: string }[];
  const remove = db.prepare('DELETE FROM photos WHERE relative_path = ?');
  const transaction = db.transaction(() => rows.filter((row) => !seenPaths.has(row.relative_path)).forEach((row) => remove.run(row.relative_path)));
  transaction();
  db.prepare('DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM photos)').run();
}

export function listAlbums(): Album[] {
  return db.prepare(`
    SELECT a.id, a.name, a.relative_path AS relativePath, COUNT(p.id) AS photoCount,
      (SELECT thumb_path FROM photos WHERE album_id = a.id ORDER BY filename LIMIT 1) AS coverPath
    FROM albums a LEFT JOIN photos p ON p.album_id = a.id
    GROUP BY a.id ORDER BY a.relative_path
  `).all() as Album[];
}

export function getAlbum(relativePath: string): { album: Album; photos: Photo[] } | undefined {
  const album = db.prepare(`
    SELECT a.id, a.name, a.relative_path AS relativePath, COUNT(p.id) AS photoCount
    FROM albums a LEFT JOIN photos p ON p.album_id = a.id WHERE a.relative_path = ? GROUP BY a.id
  `).get(relativePath) as Album | undefined;
  if (!album) return undefined;
  const rows = db.prepare('SELECT * FROM photos WHERE album_id = ? ORDER BY filename').all(album.id) as Array<Record<string, unknown>>;
  const photos = rows.map((row) => ({
    id: row.id as number, albumId: row.album_id as number, filename: row.filename as string,
    relativePath: row.relative_path as string, thumbPath: row.thumb_path as string,
    mediumPath: row.medium_path as string, largePath: row.large_path as string,
    width: row.width as number, height: row.height as number,
    metadata: JSON.parse(row.metadata as string) as ExifMetadata
  }));
  return { album, photos };
}
