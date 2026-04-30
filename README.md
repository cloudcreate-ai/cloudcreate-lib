# @cloudcreate/core

Core processing utilities shared by the web UI and future CLI entry points.

Live site: https://cloudcreate.ai
Package: https://www.npmjs.com/package/@cloudcreate/core

This package intentionally avoids Svelte, routing, local storage, and DOM download helpers. Browser-only behavior stays in `src/lib` adapters or route components.

Current modules:

- `./css`: CSS minify and beautify helpers.
- `./browser`: CloudCreate.ai tool URL builders shared by CLI/browser entry points.
- `./archive`: ZIP, GZIP, TAR.GZ, and Brotli helpers with byte-oriented APIs for CLI use and Blob convenience APIs for the browser.
- `./image`: JPEG, PNG, WebP, and AVIF decode/encode helpers plus image compression/format conversion helpers.
- `./table`: CSV, TSV, XLSX, and JSON parsing/conversion helpers.
- `./markdown`: Markdown to HTML rendering with optional caller-provided sanitization.
- `./pdf`: PDF document info helpers for page counts, page sizes, and basic metadata.

## Migration

This package was previously published as `@cloudcreate/cloudcreate-core`.

- New package name: `@cloudcreate/core`
- Old package is deprecated with migration guidance

Import migration examples:

```js
// before
import { minifyAggressive } from '@cloudcreate/cloudcreate-core/css';

// after
import { minifyAggressive } from '@cloudcreate/core/css';
```

## Release docs

- Changelog: `CHANGELOG.md`
- Release checklist: `RELEASE.md`

Example:

```js
import { minifyAggressive } from '@cloudcreate/core/css';
import { archive } from '@cloudcreate/core';

const css = minifyAggressive('.demo { color: red; }');
const zipBytes = await archive.compressZipBytes([
  { name: 'style.css', data: new TextEncoder().encode(css) },
]);
```

PDF info example:

```js
import { getPdfInfo } from '@cloudcreate/core/pdf';

const info = await getPdfInfo(pdfBytes, { maxPages: 3 });
console.log(info.numPages, info.pages[0]);
```
