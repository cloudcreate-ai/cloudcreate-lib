# @cloudcreate/cloudcreate-core

Core processing utilities shared by the web UI and future CLI entry points.

This package intentionally avoids Svelte, routing, local storage, and DOM download helpers. Browser-only behavior stays in `src/lib` adapters or route components.

Current modules:

- `./css`: CSS minify and beautify helpers.
- `./archive`: ZIP, GZIP, TAR.GZ, and Brotli helpers with byte-oriented APIs for CLI use and Blob convenience APIs for the browser.
- `./image`: JPEG, PNG, WebP, and AVIF decode/encode helpers plus image compression/format conversion helpers.
- `./table`: CSV, TSV, XLSX, and JSON parsing/conversion helpers.
- `./markdown`: Markdown to HTML rendering with optional caller-provided sanitization.

Example:

```js
import { minifyAggressive } from '@cloudcreate/cloudcreate-core/css';
import { archive } from '@cloudcreate/cloudcreate-core';

const css = minifyAggressive('.demo { color: red; }');
const zipBytes = await archive.compressZipBytes([
  { name: 'style.css', data: new TextEncoder().encode(css) },
]);
```
