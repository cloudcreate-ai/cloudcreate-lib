export const DEFAULT_CLOUDCREATE_ORIGIN = 'https://cloudcreate.ai';

const TOOL_PATHS = {
  'css:minify': '/css/minify',
  'css:beautify': '/css/beautify',
  'markdown:html': '/markdown',
  'table:convert': '/table',
  'archive:compress': '/archive/compress',
  'archive:decompress': '/archive/decompress',
  'image:compress': '/image/compress',
  'image:convert': '/image/convert',
  'image:resize': '/image/resize',
  'image:crop': '/image/crop',
  'image:rotate': '/image/rotate',
  'image:preview': '/image/preview',
  'image:favicon': '/image/favicon',
  'image:batch': '/image/batch',
  'image:gif': '/image/gif',
  'image:appstore': '/image/appstore',
  'image:playstore': '/image/playstore',
  'pdf:view': '/pdf',
  'pdf:compress': '/pdf/compress',
  'pdf:extract': '/pdf/extract',
  workflow: '/workflow',
  'workflow:advanced': '/workflow/advanced',
};

const ALIASES = {
  css: 'css:minify',
  minify: 'css:minify',
  beautify: 'css:beautify',
  markdown: 'markdown:html',
  md: 'markdown:html',
  table: 'table:convert',
  archive: 'archive:compress',
  compress: 'image:compress',
  convert: 'image:convert',
  resize: 'image:resize',
  crop: 'image:crop',
  rotate: 'image:rotate',
  preview: 'image:preview',
  favicon: 'image:favicon',
  batch: 'image:batch',
  gif: 'image:gif',
  appstore: 'image:appstore',
  playstore: 'image:playstore',
  pdf: 'pdf:view',
};

const IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif'];
const ARCHIVE_FORMATS = ['zip', 'gzip', 'targz', 'brotli'];
const TABLE_FORMATS = ['csv', 'tsv', 'xlsx', 'json'];

export const BROWSER_TOOLS = Object.freeze(
  Object.entries(TOOL_PATHS).map(([id, path]) => Object.freeze({ id, path }))
);

function firstOption(options, names) {
  for (const name of names) {
    const value = options?.[name];
    if (value != null && value !== '' && value !== false) return value;
  }
  return undefined;
}

function asInt(value, { min, max } = {}) {
  if (value == null || value === '' || value === true) return undefined;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max ?? n, Math.max(min ?? n, n));
}

function asFormat(value, formats) {
  if (value == null || value === '' || value === true) return undefined;
  const f = String(value).toLowerCase();
  if (formats.includes(f)) return f === 'jpg' ? 'jpeg' : f;
  return undefined;
}

export function normalizeBrowserTool(tool) {
  const key = String(tool || '').trim().toLowerCase();
  return ALIASES[key] || key;
}

export function getBrowserTool(tool) {
  const id = normalizeBrowserTool(tool);
  const path = TOOL_PATHS[id];
  return path ? { id, path } : null;
}

export function buildToolQuery(tool, options = {}) {
  const id = normalizeBrowserTool(tool);
  const p = new URLSearchParams();

  if (id === 'css:minify') {
    const level = String(firstOption(options, ['level', 'l']) || '').toLowerCase();
    if (level === 'aggressive' || level === 'a') p.set('level', 'aggressive');
    if (level === 'basic' || level === 'b') p.set('level', 'basic');
  }

  if (id === 'table:convert') {
    const format = asFormat(firstOption(options, ['format', 'f', 'out']), TABLE_FORMATS);
    if (format) p.set('fmt', format);
  }

  if (id === 'archive:compress') {
    const format = asFormat(firstOption(options, ['format', 'f']), ARCHIVE_FORMATS);
    if (format) p.set('fmt', format);
  }

  if (id === 'image:compress' || id === 'image:convert') {
    const quality = asInt(firstOption(options, ['quality', 'q']), { min: 1, max: 100 });
    const format = asFormat(firstOption(options, ['format', 'f']), IMAGE_FORMATS);
    if (quality != null) p.set('q', String(quality));
    if (format) p.set('f', format);
  }

  if (id === 'image:resize') {
    const mode = String(firstOption(options, ['mode', 'm']) || '').toLowerCase();
    if (['percent', 'max', 'width', 'height', 'long', 'exact'].includes(mode)) p.set('mode', mode);
    const pairs = [
      ['percent', 'p'],
      ['maxWidth', 'maw'],
      ['maxHeight', 'mah'],
      ['width', 'tw'],
      ['height', 'th'],
      ['long', 'tl'],
      ['quality', 'q'],
    ];
    for (const [from, to] of pairs) {
      const value = asInt(firstOption(options, [from, to]), { min: 1, max: from === 'quality' ? 100 : undefined });
      if (value != null) p.set(to, String(value));
    }
    const format = asFormat(firstOption(options, ['format', 'f']), IMAGE_FORMATS);
    if (format) p.set('f', format);
  }

  if (id === 'image:crop') {
    const preset = String(firstOption(options, ['preset', 'p']) || '').toLowerCase();
    if (['free', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', 'custom'].includes(preset)) {
      p.set('preset', preset);
    }
    const width = asInt(firstOption(options, ['customWidth', 'cw', 'width']), { min: 1 });
    const height = asInt(firstOption(options, ['customHeight', 'ch', 'height']), { min: 1 });
    if (width != null) p.set('cw', String(width));
    if (height != null) p.set('ch', String(height));
    const quality = asInt(firstOption(options, ['quality', 'q']), { min: 1, max: 100 });
    const format = asFormat(firstOption(options, ['format', 'f']), IMAGE_FORMATS);
    if (quality != null) p.set('q', String(quality));
    if (format) p.set('f', format);
  }

  if (id === 'image:rotate') {
    const rotate = asInt(firstOption(options, ['rotate', 'r']));
    if ([0, 90, 180, 270].includes(rotate)) p.set('r', String(rotate));
    const flipH = firstOption(options, ['flipH', 'fh']);
    const flipV = firstOption(options, ['flipV', 'fv']);
    if (flipH != null) p.set('fh', flipH === true || flipH === '1' || flipH === 'true' ? '1' : '0');
    if (flipV != null) p.set('fv', flipV === true || flipV === '1' || flipV === 'true' ? '1' : '0');
    const quality = asInt(firstOption(options, ['quality', 'q']), { min: 1, max: 100 });
    const format = asFormat(firstOption(options, ['format', 'f']), IMAGE_FORMATS);
    if (quality != null) p.set('q', String(quality));
    if (format) p.set('f', format);
  }

  if (id === 'pdf:extract') {
    const pages = String(firstOption(options, ['pages', 'p']) || '').trim();
    if (pages) p.set('pages', pages);
  }

  return p;
}

export function buildCloudCreateToolUrl(tool, options = {}) {
  const found = getBrowserTool(tool);
  if (!found) {
    throw new Error(`Unknown CloudCreate browser tool: ${tool}`);
  }

  const origin = String(options.origin || options.baseUrl || DEFAULT_CLOUDCREATE_ORIGIN).replace(/\/+$/, '');
  const locale = options.locale ? `/${String(options.locale).replace(/^\/+|\/+$/g, '')}` : '';
  const query = options.query instanceof URLSearchParams
    ? options.query
    : buildToolQuery(found.id, options);
  const search = query.toString();
  return `${origin}${locale}${found.path}${search ? `?${search}` : ''}`;
}
