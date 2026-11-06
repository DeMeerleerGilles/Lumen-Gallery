import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

function color(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
const settingsPath = path.join(dataDir, 'gallery-settings.json');
type ManagedSettings = {
  siteTitle: string;
  siteTagline: string;
  accentColor: string;
  enableDownloads: boolean;
  enableMap: boolean;
  enableProofing: boolean;
};

function readManagedSettings(): Partial<ManagedSettings> {
  try {
    if (!fs.existsSync(settingsPath)) return {};
    const parsed: unknown = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed as Partial<ManagedSettings> : {};
  } catch (error) {
    console.warn(`Unable to read ${settingsPath}:`, error);
    return {};
  }
}

const stored = readManagedSettings();
const envSettings: ManagedSettings = {
  siteTitle: process.env.SITE_TITLE?.trim() || 'Lumen Gallery',
  siteTagline: process.env.SITE_TAGLINE?.trim() || 'Every memory, beautifully arranged.',
  accentColor: color(process.env.ACCENT_COLOR, '#d9a86c'),
  enableDownloads: bool(process.env.ENABLE_DOWNLOADS, true),
  enableMap: bool(process.env.ENABLE_MAP, true),
  enableProofing: bool(process.env.ENABLE_PROOFING, true)
};
const managedSettings: ManagedSettings = {
  siteTitle: typeof stored.siteTitle === 'string' && stored.siteTitle.trim() ? stored.siteTitle.trim().slice(0, 100) : envSettings.siteTitle,
  siteTagline: typeof stored.siteTagline === 'string' && stored.siteTagline.trim() ? stored.siteTagline.trim().slice(0, 180) : envSettings.siteTagline,
  accentColor: typeof stored.accentColor === 'string' && /^#[\da-f]{6}$/i.test(stored.accentColor) ? stored.accentColor : envSettings.accentColor,
  enableDownloads: typeof stored.enableDownloads === 'boolean' ? stored.enableDownloads : envSettings.enableDownloads,
  enableMap: typeof stored.enableMap === 'boolean' ? stored.enableMap : envSettings.enableMap,
  enableProofing: typeof stored.enableProofing === 'boolean' ? stored.enableProofing : envSettings.enableProofing
};

export const config: ManagedSettings & {
  port: number;
  photosDir: string;
  dataDir: string;
  cacheDir: string;
  scanIntervalMs: number;
  imageQuality: number;
  adminPassword?: string;
} = {
  port: positiveInt(process.env.PORT, 3000),
  photosDir: path.resolve(process.env.PHOTOS_DIR ?? './photos'),
  dataDir,
  cacheDir: path.resolve(process.env.CACHE_DIR ?? './cache'),
  scanIntervalMs: positiveInt(process.env.SCAN_INTERVAL_MS, 300_000),
  imageQuality: Math.min(100, Math.max(1, positiveInt(process.env.IMAGE_QUALITY, 82))),
  ...managedSettings,
  adminPassword: process.env.ADMIN_PASSWORD?.trim() || undefined
};

export function updateManagedSettings(next: Partial<ManagedSettings>): ManagedSettings {
  if (typeof next.siteTitle === 'string' && next.siteTitle.trim()) config.siteTitle = next.siteTitle.trim().slice(0, 100);
  if (typeof next.siteTagline === 'string' && next.siteTagline.trim()) config.siteTagline = next.siteTagline.trim().slice(0, 180);
  if (typeof next.accentColor === 'string' && /^#[\da-f]{6}$/i.test(next.accentColor)) config.accentColor = next.accentColor;
  if (typeof next.enableDownloads === 'boolean') config.enableDownloads = next.enableDownloads;
  if (typeof next.enableMap === 'boolean') config.enableMap = next.enableMap;
  if (typeof next.enableProofing === 'boolean') config.enableProofing = next.enableProofing;

  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify({
    siteTitle: config.siteTitle,
    siteTagline: config.siteTagline,
    accentColor: config.accentColor,
    enableDownloads: config.enableDownloads,
    enableMap: config.enableMap,
    enableProofing: config.enableProofing
  }, null, 2)}\n`);
  return getManagedSettings();
}

export function getManagedSettings(): ManagedSettings {
  return {
    siteTitle: config.siteTitle,
    siteTagline: config.siteTagline,
    accentColor: config.accentColor,
    enableDownloads: config.enableDownloads,
    enableMap: config.enableMap,
    enableProofing: config.enableProofing
  };
}
