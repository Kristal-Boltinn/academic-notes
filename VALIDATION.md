# 2.7.0 iPad and mobile availability

- Thirteen Node regressions pass, including mobile command registration, no PDF commands on mobile, and unavailable-PDF diagnostics. The distributable `main.js` loads in a simulated iPad host that throws on Electron or Node module imports.
- Native Electron verification passed 13 palette cases and a ten-page PDF with 17 valid internal links, no invalid links, no horizontal overflow, and print-window isolation checks.
- This does not constitute testing on a physical iPad or guarantee that the Community directory has refreshed its listing. The actual iPad installation and reading/Live Preview interface remain to be checked by a user with that device.

# 2.6.0 custom environment appearance

- Twelve Node regressions pass, including validated color/motif settings, independent environment edits/reset and restoration of pre-existing inline variables on unload. TypeScript and ESLint pass with only the existing isolated print-window DOM-helper warning.
- Native Electron tests pass against default styles, Phycat and Minimal: 39 default palette cases plus custom light/dark accents, title contrast, independent nested callouts, motif colors, hidden motifs, unframed Proof/Remark and Style Settings geometry controls.
- All three actual PDF exports retain valid links and report no horizontal overflow: default/Minimal ten pages and 17 internal links; Phycat eleven pages and 25 internal links. Custom appearance is included in the export fixture. Existing subfigure, cross-chapter reference, CSP, cancellation and cleanup checks pass.
- The nine original vector motifs were inspected enlarged and at 27 px. Settings controls are tested with an Obsidian API mock; actual Obsidian host UI acceptance remains separate.

# 2.5.1 untitled subfigure captions

- Ten Node regressions pass, including untitled subfigures with existing IDs, mixed titled/untitled groups, explicit manual/suppressed numbers, cross-file references and reference removal. Decorative subfigures retain anchors but do not consume a letter.
- Chromium tests use the actual mediaRecord adapter and numbering engine with a minimal Obsidian API mock. Reading and Live Preview DOM contexts check hidden caption text and zero caption height, visible image content, reference-driven restoration, explicitly written "Subfigure" titles and retained folding controls. Export hides empty folding-caption rows after unfolding.
- TypeScript, lint and release checks pass; the existing isolated print-window DOM-helper warning remains. Two builds reproduce identical main.js/styles.css hashes. No additional priority declarations were introduced.
- Default, Phycat and Minimal checks all passed, including 39 palette cases and actual PDF exports with no invalid links or horizontal overflow. The final PDF mixed-caption page was rendered and visually checked: the untitled image has no label and its titled neighbor starts at (a).
- Actual Obsidian host UI acceptance remains separate from these synthetic tests.

# 2.5.0 environment insertion and subfigure layout — 2026-09-21

- TypeScript/build and nine Node regressions passed. Generated 2, 3, 4, 6 and 12-image templates parse into correctly nested subfigures with unique per-note block IDs; layout options preserve automatic, manual and suppressed numbering metadata. Existing localization and reference regressions remain covered.
- Native Electron checks 2, 3, 4 and 6-image groups at 300, 500, 700 and 900-pixel widths, shared heights with mixed image ratios, explicit column caps and clearing the height option. Four-image groups use 1, 2 or 4 columns, never 3+1. Checks run against default styles, installed Phycat and installed Minimal, alongside the existing 39 palette cases.
- Illustrated PDF fixtures now include forward and backward cross-chapter theorem block links and a four-image group. Source DOM checks require both links to resolve into the other chapter; PDF checks require valid internal destinations and no horizontal overflow. Print isolation, cancellation and bilingual failure cleanup remain covered.
- All three theme runs passed: default and Minimal PDFs have ten pages and 17 internal links; Phycat has eleven pages and 25 internal links. None reported invalid links or horizontal overflow. The final four-image PDF page was rendered and visually checked for 2+2 layout, equal image heights and complete captions. Two consecutive builds reproduced identical main.js/styles.css hashes.
- UI labels use the existing Obsidian-language translation mechanism. The optional LaTeX Suite snippet file is syntax-checked against its documented snippet structure; it has not been exercised inside a live LaTeX Suite installation.
- These are synthetic desktop/Electron checks. Actual Obsidian command-modal and Live Preview acceptance, other operating systems and the next official scanner run remain separate checks.

# 2.4.0 language and CSS update — 2026-09-21

- TypeScript/build, eight Node regressions and the three-file release check passed. Chinese (including a zh-TW locale), English and an untranslated locale exercise settings labels, stable dropdown values, English fallback and message placeholders.
- Native Electron 43 passed 13 palette cases with each of default styles, Phycat and Minimal (39 combinations). Added light/dark reading and editable-table hover checks, and verified exported subfigure grids remain side by side.
- All three themes exported illustrated books with 15 valid internal links, no invalid links and no horizontal overflow. Default and Minimal produced eight pages; Phycat produced ten. Default PDF pages were rendered for visual inspection of figures, three-line tables and the long proof's final QED.
- English and Chinese broken-image errors were exercised inside the isolated print window. Cancellation, cleanup, mandatory CSP and denied Node/file/network access passed.
- Released styles.css contains 61 !important declarations (previously 130). Across that generated file and the four CSS source files, there are 170 occurrences (previously 326); these are occurrence counts, not a prediction of every scanner warning.
- Actual Obsidian host UI acceptance and the next Community Directory scan remain separate checks. Language is initialized from Obsidian's public getLanguage() API when the plugin loads; changing the application language requires its normal restart.

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
