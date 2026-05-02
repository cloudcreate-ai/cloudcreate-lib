# Changelog

All notable changes to `@cloudcreate/core` are documented in this file.

## [0.2.0] - 2026-05-02

### Added
- New `./pdf` module capabilities for:
  - document info and basic metadata
  - page extraction by page/range spec
  - multi-file PDF merge
  - page splitting to one-page documents

### Notes
- This release makes the shared PDF helpers available for both CLI and web integrations through `@cloudcreate/core/pdf`.

## [0.1.1] - 2026-04-29

### Added
- New `./browser` module for CloudCreate tool URL construction:
  - tool key normalization
  - route mapping
  - query parameter builders
  - production/local origin URL generation

### Changed
- Package renamed from `@cloudcreate/cloudcreate-core` to `@cloudcreate/core`.
- Updated package exports and README examples to the new package name.

### Notes
- Previous package name remains available with deprecation guidance.

## [0.1.0] - 2026-04-28

### Added
- Initial public release with core modules:
  - `./css`
  - `./archive`
  - `./image`
  - `./table`
  - `./markdown`
