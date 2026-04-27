import { unzipSync, zipSync, gzipSync, gunzipSync } from 'fflate';

let brotliModule = null;

function isNodeRuntime() {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

async function getBrotli() {
  if (brotliModule) return brotliModule;
  if (isNodeRuntime()) {
    const nodeZlib = 'node:zlib';
    const { brotliCompressSync, brotliDecompressSync } = await import(nodeZlib);
    brotliModule = {
      compress(data) {
        return brotliCompressSync(data);
      },
      decompress(data) {
        return brotliDecompressSync(data);
      },
    };
    return brotliModule;
  }
  const mod = await import('brotli-wasm');
  brotliModule = await (mod.default ?? mod);
  return brotliModule;
}

function readBytesSync(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input?.data != null) return readBytesSync(input.data);
  throw new Error('Expected ArrayBuffer, Uint8Array, or data entry');
}

async function readBytes(input) {
  if (input instanceof Uint8Array || input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    return readBytesSync(input);
  }
  if (input?.data != null) return readBytes(input.data);
  if (input?.file != null) return readBytes(input.file);
  if (typeof input?.arrayBuffer === 'function') {
    return new Uint8Array(await input.arrayBuffer());
  }
  throw new Error('Expected file-like object, ArrayBuffer, Uint8Array, or data entry');
}

function entryName(input, index = 0) {
  return input?.name || input?.file?.name || `file_${index}`;
}

function toBlob(bytes, type = '') {
  if (typeof Blob === 'undefined') {
    throw new Error('Blob is not available in this runtime. Use the *Bytes/*Entries APIs instead.');
  }
  return new Blob([bytes], { type });
}

function withBlobs(entries, type = '') {
  return entries.map((entry) => ({
    ...entry,
    blob: toBlob(entry.data, type),
  }));
}

function readTarString(block, offset, len) {
  const slice = block.subarray(offset, offset + len);
  const nullIdx = slice.indexOf(0);
  const cut = nullIdx >= 0 ? slice.subarray(0, nullIdx) : slice;
  return new TextDecoder('utf-8').decode(cut).replace(/\0/g, '').trim();
}

function readTarOctal(block, offset, len) {
  const s = readTarString(block, offset, len);
  return s ? parseInt(s, 8) || 0 : 0;
}

export function parseTarEntries(input) {
  const arr = readBytesSync(input);
  const files = [];
  let pos = 0;

  while (pos + 512 <= arr.length) {
    const block = arr.subarray(pos, pos + 512);
    if (block.every((b) => b === 0)) break;

    const prefix = readTarString(block, 345, 155);
    const namePart = readTarString(block, 0, 100);
    const name = prefix ? `${prefix}/${namePart}` : namePart;
    const size = readTarOctal(block, 124, 12);
    const typeflag = block[156];

    if (typeflag === 0 || typeflag === 0x30) {
      const data = arr.slice(pos + 512, pos + 512 + size);
      if (name && !name.endsWith('/')) {
        files.push({ name: name.replace(/\/$/, ''), size, data });
      }
    }

    pos += 512 + Math.ceil(size / 512) * 512;
  }

  return files;
}

function writeTarString(s, len) {
  const enc = new TextEncoder().encode(String(s).slice(0, len));
  const buf = new Uint8Array(len);
  buf.set(enc);
  return buf;
}

function writeTarOctal(n, len) {
  return writeTarString(n.toString(8), len);
}

export function createTarBytes(files) {
  const chunks = [];

  for (const f of files) {
    const data = readBytesSync(f.data);
    const name = entryName(f).slice(0, 100);
    const header = new Uint8Array(512);
    header.set(writeTarString(name, 100), 0);
    header.set(writeTarString('0000644', 8), 100);
    header.set(writeTarString('0000000', 8), 108);
    header.set(writeTarString('0000000', 8), 116);
    header.set(writeTarOctal(data.length, 12), 124);
    header.set(writeTarOctal(Math.floor(Date.now() / 1000), 12), 136);
    header.set(writeTarString('0', 1), 156);
    header.set(writeTarString('ustar', 6), 257);

    const blockCount = Math.ceil(data.length / 512);
    const content = new Uint8Array(blockCount * 512);
    content.set(data);
    chunks.push(header, content);
  }

  chunks.push(new Uint8Array(1024));
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export function decompressZipEntries(buffer) {
  const files = unzipSync(readBytesSync(buffer));
  return Object.entries(files).map(([name, data]) => ({
    name,
    size: data.length,
    data,
  }));
}

export function decompressZip(buffer) {
  return withBlobs(decompressZipEntries(buffer));
}

export function decompressGzipEntries(buffer) {
  const out = gunzipSync(readBytesSync(buffer));
  return [{ name: 'extracted', size: out.length, data: out }];
}

export function decompressGzip(buffer) {
  return withBlobs(decompressGzipEntries(buffer));
}

export function decompressTarGzEntries(buffer) {
  const tarBytes = gunzipSync(readBytesSync(buffer));
  return parseTarEntries(tarBytes);
}

export function decompressTarGz(buffer) {
  return withBlobs(decompressTarGzEntries(buffer));
}

export async function decompressBrotliEntries(buffer) {
  const brotli = await getBrotli();
  const out = brotli.decompress(readBytesSync(buffer));
  if (!out) throw new Error('Brotli decompress failed');
  const data = new Uint8Array(out);
  return [{ name: 'extracted', size: data.length, data }];
}

export async function decompressBrotli(buffer) {
  return withBlobs(await decompressBrotliEntries(buffer));
}

export async function compressZipBytes(files) {
  const obj = {};
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    obj[entryName(f, i)] = await readBytes(f);
  }
  return zipSync(obj);
}

export async function compressZip(files) {
  return toBlob(await compressZipBytes(files), 'application/zip');
}

export async function compressGzipBytes(file, filename) {
  const data = await readBytes(file);
  return gzipSync(data, { filename: filename || entryName(file, 0) || 'file' });
}

export async function compressGzip(file, filename) {
  return toBlob(await compressGzipBytes(file, filename), 'application/gzip');
}

export async function compressTarGzBytes(files) {
  const tarFiles = await Promise.all(
    files.map(async (f, i) => ({
      name: entryName(f, i),
      data: await readBytes(f),
    }))
  );
  return gzipSync(createTarBytes(tarFiles));
}

export async function compressTarGz(files) {
  return toBlob(await compressTarGzBytes(files), 'application/gzip');
}

export async function compressBrotliBytes(file) {
  const brotli = await getBrotli();
  const out = brotli.compress(await readBytes(file));
  if (!out) throw new Error('Brotli compress failed');
  return new Uint8Array(out);
}

export async function compressBrotli(file) {
  return toBlob(await compressBrotliBytes(file), 'application/x-brotli');
}

export const FORMATS = {
  zip: { ext: ['.zip'], decompress: decompressZip },
  gzip: { ext: ['.gz', '.gzip'], decompress: decompressGzip, singleFile: true },
  targz: { ext: ['.tgz', '.tar.gz'], decompress: decompressTarGz },
  brotli: { ext: ['.br'], decompress: decompressBrotli, singleFile: true },
};

export function detectFormat(filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'targz';
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.br')) return 'brotli';
  if (lower.endsWith('.gz') || lower.endsWith('.gzip')) return 'gzip';
  return null;
}
