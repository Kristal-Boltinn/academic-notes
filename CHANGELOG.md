# 2.2.1

- Load PDF snapshots from isolated temporary HTML files instead of oversized data URLs; remove temporary files after export.
- Distinguish Electron interface detection from actual export status in diagnostics and document where to find errors.
- Explain the optional phb-book chapter list; test an 8.8 MB snapshot.

# Changelog

## 2.2.0 — Community release candidate

- Adopt `academic-notes` as the release ID and a reproducible TypeScript/esbuild build.
- Replace the Python, Playwright and downloaded-browser runtime with Electron printToPDF and bundled pdf-lib.
- Preserve measured TOC pagination, nested PDF outlines and internal link validation.
- Include figure, subfigure and table layout in the three-file plugin release.
- Remove H6 caption conversion, link-style math-box conversion and the theme-specific palette adapter.
- Use neutral base surfaces for same-color callout fills; explain theme color and body-text settings.
- Add synthetic examples, automated tests, release checks, draft-release workflow and full usage documentation.

This is a release candidate. Community review and live host acceptance are separate from build/test success.
