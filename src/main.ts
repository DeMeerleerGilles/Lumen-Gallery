import fs from 'node:fs';
import chokidar from 'chokidar';
import { config } from './config.js';
import { createServer } from './server.js';
import { scanPhotos } from './scanner.js';

const server = createServer();
await scanPhotos();
const watcher = chokidar.watch(config.photosDir, { ignoreInitial: true });
let scanPending = false;
const scheduleScan = () => {
  if (scanPending) return;
  scanPending = true;
  setTimeout(() => { scanPending = false; void scanPhotos(); }, 500);
};
watcher.on('add', scheduleScan).on('change', scheduleScan).on('unlink', scheduleScan);
setInterval(() => void scanPhotos(), config.scanIntervalMs);
if (!fs.existsSync(config.photosDir)) console.warn(`Photos directory does not exist yet: ${config.photosDir}`);
await server.listen({ port: config.port, host: '0.0.0.0' });
