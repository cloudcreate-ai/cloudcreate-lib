import * as XLSX from 'xlsx';

export const FORMATS = ['csv', 'tsv', 'xlsx', 'json'];

function cellToOriginalString(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function normalizeTableRow(row) {
  if (!Array.isArray(row)) return [cellToOriginalString(row)];
  return row.map(cellToOriginalString);
}

function getExtension(filename) {
  return (filename?.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
}

async function readText(source) {
  if (typeof source === 'string') return source;
  if (typeof source?.text === 'function') return source.text();
  const buffer = await readArrayBuffer(source);
  return new TextDecoder().decode(buffer);
}

async function readArrayBuffer(source) {
  if (source instanceof ArrayBuffer) return source;
  if (source instanceof Uint8Array) {
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  }
  if (ArrayBuffer.isView(source)) {
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  }
  if (typeof source?.arrayBuffer === 'function') return source.arrayBuffer();
  throw new Error('Expected text, ArrayBuffer, Uint8Array, or file-like source');
}

export async function parseTableSource(source, filename = '') {
  const ext = getExtension(filename);

  if (ext === 'json') {
    const text = await readText(source);
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length === 0) return { sheets: [{ name: 'Sheet1', headers: [], rows: [] }], format: 'json' };
    const first = arr[0];
    let headers;
    let rows;
    if (Array.isArray(first)) {
      [headers = [], ...rows] = arr.map((r) => (Array.isArray(r) ? normalizeTableRow(r) : [cellToOriginalString(r)]));
    } else {
      headers = [...new Set(arr.flatMap((o) => (typeof o === 'object' && o !== null ? Object.keys(o) : [])))];
      rows = arr.map((o) =>
        typeof o === 'object' && o !== null
          ? headers.map((h) => (o[h] != null ? cellToOriginalString(o[h]) : ''))
          : [cellToOriginalString(o)]
      );
    }
    return { sheets: [{ name: 'Sheet1', headers, rows }], format: 'json' };
  }

  if (ext === 'csv' || ext === 'tsv') {
    const text = await readText(source);
    let fs = ext === 'tsv' ? '\t' : ',';
    if (ext === 'csv') {
      const firstLine = (text.split(/\r?\n/).find((l) => l.trim()) ?? '').trimEnd();
      const tabCount = (firstLine.match(/\t/g) ?? []).length;
      const commaCount = (firstLine.match(/,/g) ?? []).length;
      if (tabCount > commaCount) fs = '\t';
    }
    const wb = XLSX.read(text, { type: 'string', FS: fs, raw: true });
    return { ...workbookToSheets(wb), format: ext };
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await readArrayBuffer(source);
    const wb = XLSX.read(buf, { type: 'array' });
    return { ...workbookToSheets(wb), format: ext };
  }

  throw new Error(`Unsupported format: ${ext}`);
}

export async function parseTableFile(file) {
  return parseTableSource(file, file?.name || '');
}

function workbookToSheets(wb) {
  const sheets = [];
  for (const name of wb.SheetNames || []) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    const [headers = [], ...rows] = data.map((r) => normalizeTableRow(r));
    sheets.push({ name, headers, rows });
  }
  if (sheets.length === 0) sheets.push({ name: 'Sheet1', headers: [], rows: [] });
  return { sheets };
}

export function tableToOutput(result, format, sheetIndex = 0) {
  const sheets = result.sheets || [];
  const sheet = sheets[sheetIndex] || { headers: [], rows: [] };
  const { headers, rows } = sheet;
  const data = [headers, ...rows];

  if (format === 'json') {
    const arr = rows.map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i] ?? ''));
      return obj;
    });
    return {
      data: JSON.stringify(arr, null, 2),
      mime: 'application/json',
      ext: 'json',
    };
  }

  if (format === 'csv' || format === 'tsv') {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const str = XLSX.utils.sheet_to_csv(ws, { FS: format === 'tsv' ? '\t' : ',', strip: false });
    return {
      data: str,
      mime: format === 'tsv' ? 'text/tab-separated-values' : 'text/csv',
      ext: format,
    };
  }

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i];
      const d = [s.headers, ...s.rows];
      const ws = XLSX.utils.aoa_to_sheet(d);
      XLSX.utils.book_append_sheet(wb, ws, s.name || `Sheet${i + 1}`);
    }
    return {
      data: XLSX.write(wb, { type: 'array', bookType: 'xlsx' }),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ext: 'xlsx',
    };
  }

  throw new Error(`Unsupported output format: ${format}`);
}

export function tableToBlob(result, format, sheetIndex = 0) {
  if (typeof Blob === 'undefined') {
    throw new Error('Blob is not available in this runtime. Use tableToOutput instead.');
  }
  const output = tableToOutput(result, format, sheetIndex);
  return new Blob([output.data], { type: output.mime });
}
