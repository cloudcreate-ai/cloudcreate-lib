import UPNG from 'upng-js';

const CODEC_INFO = {
  jpeg: {
    mime: 'image/jpeg',
    ext: 'jpg',
    async load() {
      return import('@jsquash/jpeg');
    },
  },
  png: {
    mime: 'image/png',
    ext: 'png',
    async load() {
      if (isNodeRuntime()) {
        return loadNodePngCodec();
      }
      return import('@jsquash/png');
    },
  },
  webp: {
    mime: 'image/webp',
    ext: 'webp',
    async load() {
      return import('@jsquash/webp');
    },
  },
  avif: {
    mime: 'image/avif',
    ext: 'avif',
    async load() {
      const [decodeMod, encodeMod] = await Promise.all([
        import('@jsquash/avif/decode.js'),
        import('@jsquash/avif/encode.js'),
      ]);
      return {
        decode: decodeMod.default,
        encode: encodeMod.default,
      };
    },
  },
};

const loadedCodecs = new Map();

function isNodeRuntime() {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

async function loadNodePngCodec() {
  const pngjsSpecifier = 'pngjs';
  const nodeBufferSpecifier = 'node:buffer';
  const [{ PNG }, { Buffer }] = await Promise.all([
    import(pngjsSpecifier),
    import(nodeBufferSpecifier),
  ]);
  return {
    decode(buffer) {
      const png = PNG.sync.read(Buffer.from(toArrayBuffer(buffer)));
      return {
        data: new Uint8ClampedArray(png.data),
        width: png.width,
        height: png.height,
      };
    },
    encode(imageData) {
      const d = imageData.data;
      const buf = d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
      return UPNG.encode([buf], imageData.width, imageData.height, 0);
    },
  };
}

export const DECODE_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif'];
export const ENCODE_FORMATS = ['jpeg', 'png', 'webp', 'avif'];

export function normalizeImageFormat(format) {
  return (format || '').toLowerCase().replace('image/', '').replace(/^\./, '').replace('jpg', 'jpeg');
}

async function getCodec(format) {
  const key = normalizeImageFormat(format);
  const info = CODEC_INFO[key];
  if (!info) return null;
  if (loadedCodecs.has(key)) return loadedCodecs.get(key);
  const mod = await info.load();
  const codec = {
    decode: mod.decode || mod.default?.decode,
    encode: mod.encode || mod.default?.encode,
    mime: info.mime,
    ext: info.ext,
  };
  loadedCodecs.set(key, codec);
  return codec;
}

function normalizeQuality(quality, fallback = 75) {
  const value = Number(quality);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
}

function toArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (buffer instanceof Uint8Array) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  if (ArrayBuffer.isView(buffer)) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  throw new Error('Expected ArrayBuffer or typed array');
}

function toBlob(buffer, type = '') {
  if (typeof Blob === 'undefined') {
    throw new Error('Blob is not available in this runtime. Use the byte-oriented image APIs instead.');
  }
  return new Blob([buffer], { type });
}

export function getImageFormatFromNameAndMime(name = '', mime = '') {
  const mimeLower = (mime || '').toLowerCase();
  const ext = (name?.split('.').pop() || '').toLowerCase();
  if (mimeLower.includes('jpeg') || mimeLower.includes('jpg') || ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  if (mimeLower.includes('png') || ext === 'png') return 'png';
  if (mimeLower.includes('webp') || ext === 'webp') return 'webp';
  if (mimeLower.includes('avif') || ext === 'avif') return 'avif';
  return 'png';
}

export function getFormatFromFile(file) {
  return getImageFormatFromNameAndMime(file?.name || '', file?.type || '');
}

export async function decodeImage(buffer, mimeType) {
  const codec = await getCodec(mimeType);
  if (!codec) throw new Error(`Unsupported format: ${mimeType}`);
  return codec.decode(toArrayBuffer(buffer));
}

export async function decodeImageBytes(buffer, mimeType) {
  return decodeImage(buffer, mimeType);
}

export async function encodeImage(imageData, targetFormat, quality = 75) {
  const codec = await getCodec(targetFormat);
  if (!codec) throw new Error(`Unsupported format: ${targetFormat}`);

  const format = normalizeImageFormat(targetFormat);
  const opts = {};
  if (['jpeg', 'webp', 'avif'].includes(format)) {
    opts.quality = normalizeQuality(quality);
  }
  if (format === 'avif') {
    opts.lossless = opts.quality >= 100;
  }

  const buffer = await codec.encode(imageData, opts);
  return { buffer, mime: codec.mime, ext: codec.ext };
}

export function encodePngQuantized(imageData, quality = 75) {
  const colors = Math.max(32, Math.min(256, Math.round(32 + (normalizeQuality(quality) / 100) * 224)));
  const d = imageData.data;
  const buf = d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
  const png = UPNG.encode([buf], imageData.width, imageData.height, colors);
  return { buffer: png, mime: 'image/png', ext: 'png' };
}

export async function encodeImageForFormat(imageData, targetFormat, quality = 75) {
  const format = normalizeImageFormat(targetFormat || 'png');
  return format === 'png' ? encodePngQuantized(imageData, quality) : encodeImage(imageData, format, quality);
}

export async function fileToImageData(file) {
  const buffer = await file.arrayBuffer();
  const mime = file.type || getFormatFromFile(file) || 'image/png';
  return decodeImage(buffer, mime);
}

export async function compressImageData(imageData, { targetFormat = 'png', quality = 75 } = {}) {
  const result = await encodeImageForFormat(imageData, targetFormat, quality);
  return {
    ...result,
    width: imageData.width,
    height: imageData.height,
  };
}

export async function compressImageBytes(buffer, { sourceFormat = 'png', targetFormat, quality = 75 } = {}) {
  const imageData = await decodeImage(buffer, sourceFormat);
  return compressImageData(imageData, { targetFormat: targetFormat || sourceFormat, quality });
}

export async function compressImageFile(file, { quality = 75, targetFormat } = {}) {
  const sourceFormat = getFormatFromFile(file);
  const format = normalizeImageFormat(targetFormat || sourceFormat || 'png');
  const imageData = await fileToImageData(file);
  const { buffer, mime, ext } = await compressImageData(imageData, {
    targetFormat: format,
    quality,
  });
  const blob = toBlob(buffer, mime);
  const newSize = blob.size;
  const ratio = file.size > 0 ? (1 - newSize / file.size) * 100 : 0;
  const base = (file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
  return {
    blob,
    outputName: `${base}.${ext}`,
    newSize,
    ratio,
    width: imageData.width,
    height: imageData.height,
  };
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export function formatLabelFromFilename(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'jpg' || ext === 'jpeg') return 'JPEG';
  return ext ? ext.toUpperCase() : '';
}
