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

function assertPositiveInt(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function parsePdfPageRangeSpec(spec, totalPages) {
  assertPositiveInt(totalPages, 'totalPages');
  const text = String(spec || '').trim();
  if (!text) {
    throw new Error('Page range is required');
  }

  const out = [];
  const seen = new Set();

  for (const rawPart of text.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      assertPositiveInt(start, 'Range start');
      assertPositiveInt(end, 'Range end');
      if (start > end) {
        throw new Error(`Invalid page range "${part}"`);
      }
      if (end > totalPages) {
        throw new Error(`Page ${end} exceeds document length (${totalPages})`);
      }
      for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
        if (!seen.has(pageNumber)) {
          seen.add(pageNumber);
          out.push(pageNumber);
        }
      }
      continue;
    }

    if (!/^\d+$/.test(part)) {
      throw new Error(`Invalid page token "${part}"`);
    }
    const pageNumber = Number(part);
    if (pageNumber > totalPages) {
      throw new Error(`Page ${pageNumber} exceeds document length (${totalPages})`);
    }
    if (!seen.has(pageNumber)) {
      seen.add(pageNumber);
      out.push(pageNumber);
    }
  }

  if (!out.length) {
    throw new Error('No pages selected');
  }

  return out;
}

export async function extractPdfPages(buffer, options = {}) {
  const sourceDoc = await PDFDocument.load(toUint8Array(buffer), {
    updateMetadata: false,
  });
  const totalPages = sourceDoc.getPageCount();
  const pageNumbers = Array.isArray(options.pageNumbers) && options.pageNumbers.length
    ? options.pageNumbers.map((n) => Number(n))
    : parsePdfPageRangeSpec(options.pages, totalPages);

  for (const pageNumber of pageNumbers) {
    assertPositiveInt(pageNumber, 'pageNumber');
    if (pageNumber > totalPages) {
      throw new Error(`Page ${pageNumber} exceeds document length (${totalPages})`);
    }
  }

  const outDoc = await PDFDocument.create();
  const copiedPages = await outDoc.copyPages(
    sourceDoc,
    pageNumbers.map((pageNumber) => pageNumber - 1),
  );
  for (const page of copiedPages) {
    outDoc.addPage(page);
  }

  const outBytes = await outDoc.save();
  return {
    buffer: outBytes,
    totalPages,
    extractedPages: pageNumbers,
    extractedPageCount: pageNumbers.length,
  };
}
