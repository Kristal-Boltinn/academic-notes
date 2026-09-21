# 2.3.0 appearance update — 2026-09-21

- TypeScript/build checks, seven Node regressions and the three-file release check passed. ESLint reports no errors and the same one native DOM helper warning in the isolated print window.
- Two consecutive builds produced identical main.js and styles.css SHA-256 hashes.
- Native Electron 43 checked 13 palette cases each with built-in styles, the installed Phycat stylesheet and the installed Minimal stylesheet (39 combinations). Remark titles track the selected palette. All three runs passed neutral text, same-hue box fills, and figure layout checks.
- Proof/remark aliases passed borderless layout, inline alignment, hidden icons, folding, nesting, light/dark appearance and single-QED checks in synthetic reading-view and Live Preview DOM contexts. List and displayed-equation endings were included. Hiding corner motifs does not hide QED markers.
- The final default-style fixture exported an 8,851,139-byte snapshot to eight pages in two calibration passes, with eleven valid internal links, no invalid links and no horizontal overflow. The long proof crosses page boundaries and ends with one QED square. The final fixture gives its SVG ID-cloning probe an explicit size, removing unrelated blank space in the previous nine-page test fixture.
- PDF pages were rendered with Poppler for visual review. Proof/remark README screenshots were captured from synthetic content using the final built stylesheet. No personal notes, theme files or local paths are included in the release.
- Released styles.css now contains 130 !important declarations, down from 219 in 2.2.3. Remaining overrides protect properties forced by themes, native figure/table layout and the offscreen export stage. Print resets and probe styling remain scoped to export documents.
- Print isolation, denied Node/file/network access, cancellation and failure cleanup continue to pass. These are standalone Chromium checks; actual Obsidian Live Preview, the host Electron bridge, other operating systems and the next Community Directory scan are separate acceptance checks.

# 2.2.3 review follow-up — 2026-09-20

- Native Electron exported an 8.8 MB in-memory HTML snapshot to six PDF pages in two calibration passes, with eleven valid internal links, no invalid links and no horizontal overflow. Thirteen light/dark palette cases passed.
- The print window rejects Node access, local image files and HTTP image/fetch requests to a working test server. The server received zero requests. Inline scripts and browser-triggered event handlers remained blocked even when the test removed the snapshot's original CSP, exercising the exporter's mandatory policy.
- Successful export, cancellation and a broken-image failure all destroyed their hidden print windows. Each print window uses a nonpersistent session with sandboxing and context isolation enabled.
- TOC formatting, cloned SVG glyph references, ordinary H6 headings and source-heading preservation remain covered. The snapshot builder uses mocked Obsidian DOM helpers in the synthetic Electron fixture; the print window itself has none.
- The plugin has no Node filesystem import; the release check rejects fs/fs-promises imports in the generated bundle. Development and test scripts still use filesystem APIs to build artifacts and read synthetic fixtures.
- Real Obsidian host acceptance and the next official scan are distinct from these automated checks. The user previously verified PDF export with 2.2.1; this document does not claim that test covered 2.2.3.

# 2.2.2 review follow-up — 2026-09-20

- Strict implicit-any TypeScript check, seven regression tests and three-file release validation passed.
- Official Obsidian ESLint rules: no errors; native DOM helper recommendations remain in isolated Chromium code (see REVIEW-NOTES.md).
- Native Electron: 13 palette cases passed; 8.8 MB snapshot generated a six-page PDF in two passes, with 11 valid internal links, no invalid links and no horizontal overflow.
- Added a real Chromium regression for TOC inline formatting, literal angle brackets, cloned SVG glyph references and unchanged source headings.
- Run Electron under the normal desktop account; the restricted execution account could not start its GPU subprocess. No browser sandbox protection was disabled.
- The GitHub release and attestations were subsequently verified. The supplied 2.2.2 official report passed and confirmed attestations and byte-for-byte build reproduction. Real Obsidian acceptance of 2.2.2 was not separately recorded. Older sections below describe historical checks.

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
