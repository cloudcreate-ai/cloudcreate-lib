import { marked } from 'marked';

export function markdownToHtml(md, options = {}) {
  if (!md || typeof md !== 'string') return '';
  try {
    const html = marked(md, { async: false });
    const str = typeof html === 'string' ? html : String(html ?? '');
    return typeof options.sanitizer === 'function' ? options.sanitizer(str) : str;
  } catch {
    return '';
  }
}
