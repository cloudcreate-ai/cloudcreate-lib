import { minify as cssoMinify } from 'csso';
import beautifyPkg from 'js-beautify';

const { css: cssBeautify } = beautifyPkg;

export function minifyBasic(css) {
  if (typeof css !== 'string') return '';
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function minifyAggressive(css) {
  if (typeof css !== 'string') return '';
  try {
    const result = cssoMinify(css);
    return result.css;
  } catch (e) {
    throw new Error(e.message || 'Minify failed');
  }
}

export function beautify(css) {
  if (typeof css !== 'string') return '';
  try {
    return cssBeautify(css, {
      indent_size: 2,
      indent_char: ' ',
      end_with_newline: true,
      preserve_newlines: false,
      max_preserve_newlines: 0,
      wrap_line_length: 0,
    });
  } catch (e) {
    throw new Error(e.message || 'Beautify failed');
  }
}
