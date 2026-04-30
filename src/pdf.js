import { PDFDocument } from 'pdf-lib';

const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;

function toUint8Array(buffer) {
  if (buffer instanceof Uint8Array) return buffer;
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  throw new Error('Expected PDF input as ArrayBuffer or typed array');
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function trimOrNull(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const text = value.map((item) => String(item).trim()).filter(Boolean).join(', ');
    return text || null;
  }
  const text = String(value).trim();
  return text ? text : null;
}

function toIsoOrNull(value) {
  return value instanceof Date && !Number.isNaN(value.valueOf()) ? value.toISOString() : null;
}

function buildPageSize(widthPts, heightPts) {
  return {
    widthPts: round2(widthPts),
    heightPts: round2(heightPts),
    widthIn: round2(widthPts / POINTS_PER_INCH),
    heightIn: round2(heightPts / POINTS_PER_INCH),
    widthMm: round2((widthPts / POINTS_PER_INCH) * MM_PER_INCH),
    heightMm: round2((heightPts / POINTS_PER_INCH) * MM_PER_INCH),
    orientation: widthPts >= heightPts ? 'landscape' : 'portrait',
  };
}

function readMetadata(pdfDoc) {
  return {
    title: trimOrNull(pdfDoc.getTitle?.()),
    author: trimOrNull(pdfDoc.getAuthor?.()),
    subject: trimOrNull(pdfDoc.getSubject?.()),
    keywords: trimOrNull(pdfDoc.getKeywords?.()),
    creator: trimOrNull(pdfDoc.getCreator?.()),
    producer: trimOrNull(pdfDoc.getProducer?.()),
    creationDate: toIsoOrNull(pdfDoc.getCreationDate?.()),
    modificationDate: toIsoOrNull(pdfDoc.getModificationDate?.()),
  };
}

function pruneNulls(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value != null));
}

export async function getPdfInfoFromDocument(pdfDoc, options = {}) {
  if (!pdfDoc || typeof pdfDoc.getPageCount !== 'function') {
    throw new Error('Expected a loaded PDFDocument');
  }

  const numPages = pdfDoc.getPageCount();
  const requestedMaxPages = Number(options.maxPages);
  const maxPages =
    Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
      ? Math.min(numPages, Math.floor(requestedMaxPages))
      : numPages;

  const pages = pdfDoc
    .getPages()
    .slice(0, maxPages)
    .map((page, index) => {
      const { width, height } = page.getSize();
      return {
        pageNumber: index + 1,
        rotation: page.getRotation().angle || 0,
        ...buildPageSize(width, height),
      };
    });

  return {
    numPages,
    pages,
    metadata: pruneNulls(readMetadata(pdfDoc)),
  };
}

export async function getPdfInfo(buffer, options = {}) {
  const pdfDoc = await PDFDocument.load(toUint8Array(buffer), {
    updateMetadata: false,
  });
  return getPdfInfoFromDocument(pdfDoc, options);
}
