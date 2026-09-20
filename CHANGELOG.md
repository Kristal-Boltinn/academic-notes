# 2.2.3

- Remove Node filesystem access from the installed plugin. Load PDF snapshots in memory, avoiding temporary HTML files and oversized data URLs.
- Deny permission requests in the isolated print window, in addition to blocking network and local-file requests.
- Use Obsidian DOM helpers in the snapshot and TOC builder; retain native DOM creation only in the isolated print window.
- Update repository links to Kristal-Boltinn/academic-notes and revise the bilingual privacy documentation.
- Add release checks for filesystem imports and Electron regressions for print isolation, cancellation and failure cleanup.

# 2.2.2

- Use standard MIT license text and generate build attestations for release assets.
- Replace TOC HTML assignment with DOM cloning, preserving inline formulas and glyph links.
- Move print background and glyph-cache styling to CSS; use standard setting headings.
- Add explicit types, implicit-any checking, declared CodeMirror dependencies and local Obsidian linting.
- Make settings discoverable by Obsidian 1.13 settings search while retaining the older settings UI.
- Restrict image snapshot reads to local protocols and create temporary print files exclusively with private POSIX permissions.

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
