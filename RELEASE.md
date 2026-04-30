# Release checklist

This checklist is for publishing `@cloudcreate/core`.

## 1) Pre-flight checks

1. Verify working tree:
   - `git status --short`
2. Verify package metadata:
   - `name` is `@cloudcreate/core`
   - `version` is the intended release version
   - `exports` includes all supported modules
3. Verify package contents:
   - `npm publish --dry-run --access public`

## 2) Versioning

Choose semver bump level:

- patch: bug fixes, docs-only release metadata sync
- minor: additive backward-compatible APIs
- major: breaking API changes

Update version:

```bash
npm version <patch|minor|major> --no-git-tag-version
```

## 3) Publish

1. Commit version/document updates.
2. Push to `origin/main`.
3. Publish:

```bash
npm publish --access public
```

## 4) Post-publish validation

1. Check dist-tag:
   - `npm dist-tag ls @cloudcreate/core`
2. Check installability:
   - `npm pack @cloudcreate/core@<version> --json`
3. Smoke import test:

```bash
node --input-type=module -e "import { browser } from '@cloudcreate/core'; console.log(Boolean(browser));"
```

## 5) Migration communication

If old package names or imports changed:

1. Update `README.md` migration section.
2. Update `CHANGELOG.md`.
3. Add or confirm deprecate message for old package names.
