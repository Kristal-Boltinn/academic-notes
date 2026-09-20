# 2.2.1 follow-up

TypeScript, seven regression tests and three-file release checks passed. Native Electron exported an 8,863,564-byte synthetic HTML snapshot through a temporary file, with six pages and eleven valid internal links. The user confirmed successful PDF export in Obsidian on 2026-09-20; other untested host combinations remain outside this verification. The previous data-URL path failed on the user snapshot; interface-only diagnostics previously overstated readiness.

# Validation — Academic Notes 2.2.0 release candidate

Verified locally on Windows on 2026-09-20. This records development checks, not Community Directory approval.

## Completed

- TypeScript checking and esbuild bundling: passed.
- Seven Node regression tests: passed. Coverage includes plugin lifecycle/settings cleanup, ordinary H6 headings, explicit figures, cross-file references, referenced-only equations, book numbering, manual/shared counters, nested subfigure IDs, ambiguous IDs, PDF destinations and outlines.
- Three-file release checks: passed; manifest and versions agree, removed installer/runtime code is absent, required layout and PDF code are bundled.
- Two consecutive builds produced identical SHA-256 hashes for main.js and styles.css.
- Native Electron 43 / Chromium tests: 13 light/dark palette combinations passed, including a local run with the actual installed Phycat stylesheet. All box fills match their own border hue mixed with a neutral surface; inner content is transparent. Neutral body and emphasized text colors are checked without postprocessor classes. Test measurements disable CSS transitions to check settled colors.
- Synthetic multi-note PDF: six pages, TOC stable after two print passes, eleven valid internal links, no invalid internal links or horizontal overflow; nested outline generated. H6 remains an ordinary heading.
- PDF pages 1–2 rendered with Poppler and visually inspected. Screenshots and examples contain synthetic material only.
- Local installation prepared in academic-notes; current settings preserved, previous plugin ID disabled, redundant academic-layout snippet disabled. Restart Obsidian to load this configuration.

## Still requires release acceptance

- Real Obsidian reload, reading view, Live Preview, editing commands and PDF export from the user's vault have not been exercised. The available installed launcher did not expose a usable CLI. The lifecycle test uses a mock host and exercises the safe fallback when CodeMirror has no DOM; it is not a Live Preview acceptance test.
- The standalone Electron test uses a supplied BrowserWindow constructor. Obsidian's remote bridge path must still be accepted inside the real desktop app.
- macOS, Linux and other Obsidian/Electron versions have not been tested locally. GitHub Actions is configured but has not run.
- Community Directory scan/submission and GitHub publication have not been performed. Verify ID availability and choose the public author identity before publishing; the manifest currently uses Academic Notes contributors.

See RELEASING.md for the remaining public-release steps. No personal settings or test exports belong in the source or plugin ZIP.
