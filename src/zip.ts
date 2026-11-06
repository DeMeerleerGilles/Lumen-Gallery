import zlib from 'node:zlib';
import fs from 'node:fs/promises';

interface ZipEntry {
  name: string;
  data: Buffer;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
}

// CRC32 Table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

function calculateCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates an in-memory or streamed ZIP buffer from a list of files.
 */
export async function createZipArchive(files: Array<{ name: string; filePath: string }>): Promise<Buffer> {
  const entries: ZipEntry[] = [];
  const chunks: Buffer[] = [];
  let currentOffset = 0;

  for (const file of files) {
    try {
      const rawData = await fs.readFile(file.filePath);
      const uncompressedSize = rawData.length;
      const crc = calculateCrc32(rawData);

      // Deflate with standard compression
      const deflated = zlib.deflateRawSync(rawData, { level: 6 });
      const useDeflated = deflated.length < uncompressedSize;
      const dataToStore = useDeflated ? deflated : rawData;
      const compressionMethod = useDeflated ? 8 : 0; // 8 = deflate, 0 = store

      const nameBuffer = Buffer.from(file.name, 'utf8');

      // Local File Header
      const header = Buffer.alloc(30 + nameBuffer.length);
      header.writeUInt32LE(0x04034b50, 0); // signature
      header.writeUInt16LE(20, 4); // version needed (2.0)
      header.writeUInt16LE(0x0800, 6); // general purpose bit flag (UTF-8)
      header.writeUInt16LE(compressionMethod, 8);
      header.writeUInt16LE(0, 10); // last mod file time
      header.writeUInt16LE(0, 12); // last mod file date
      header.writeUInt32LE(crc, 14);
      header.writeUInt32LE(dataToStore.length, 18); // compressed size
      header.writeUInt32LE(uncompressedSize, 22); // uncompressed size
      header.writeUInt16LE(nameBuffer.length, 26);
      header.writeUInt16LE(0, 28); // extra field length
      nameBuffer.copy(header, 30);

      entries.push({
        name: file.name,
        data: dataToStore,
        crc32: crc,
        compressedSize: dataToStore.length,
        uncompressedSize,
        offset: currentOffset
      });

      chunks.push(header, dataToStore);
      currentOffset += header.length + dataToStore.length;
    } catch (err) {
      console.warn(`Could not add file ${file.name} to zip:`, err);
    }
  }

  // Central Directory
  const centralDirectoryOffset = currentOffset;
  let centralDirectorySize = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const cdHeader = Buffer.alloc(46 + nameBuffer.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // signature
    cdHeader.writeUInt16LE(20, 4); // version made by
    cdHeader.writeUInt16LE(20, 6); // version needed
    cdHeader.writeUInt16LE(0x0800, 8); // UTF-8
    cdHeader.writeUInt16LE(entry.compressedSize < entry.uncompressedSize ? 8 : 0, 10);
    cdHeader.writeUInt16LE(0, 12); // time
    cdHeader.writeUInt16LE(0, 14); // date
    cdHeader.writeUInt32LE(entry.crc32, 16);
    cdHeader.writeUInt32LE(entry.compressedSize, 20);
    cdHeader.writeUInt32LE(entry.uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuffer.length, 28);
    cdHeader.writeUInt16LE(0, 30); // extra field length
    cdHeader.writeUInt16LE(0, 32); // comment length
    cdHeader.writeUInt16LE(0, 34); // disk number start
    cdHeader.writeUInt16LE(0, 36); // internal file attributes
    cdHeader.writeUInt32LE(0, 38); // external file attributes
    cdHeader.writeUInt32LE(entry.offset, 42); // relative offset of local header
    nameBuffer.copy(cdHeader, 46);

    chunks.push(cdHeader);
    centralDirectorySize += cdHeader.length;
  }

  // End of Central Directory Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where CD starts
  eocd.writeUInt16LE(entries.length, 8); // number of CD records on disk
  eocd.writeUInt16LE(entries.length, 10); // total number of CD records
  eocd.writeUInt32LE(centralDirectorySize, 12); // size of CD
  eocd.writeUInt32LE(centralDirectoryOffset, 16); // offset of start of CD
  eocd.writeUInt16LE(0, 20); // comment length

  chunks.push(eocd);

  return Buffer.concat(chunks);
}
