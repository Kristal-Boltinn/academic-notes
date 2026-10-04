# 2.14.0 Typography and visual indentation

- Browser regressions exercise formula-ending rows at font-dependent widths, original formula margins/node restoration, two-em first-line geometry, active editor justification and unchanged source/caret.
- Read-only Proof regression retains an inactive editable title, then exercises caret protection, copying, touch deferral and post-edit scrolling.
- Source-line classification excludes frontmatter, headings, list continuations, code/math blocks, images and block IDs.
- Chromium regressions do not establish physical iPad/WKWebView scrolling behavior; device acceptance remains outstanding.

# 2.13.3 Device evidence and visible recordings

- An actual iPad report showed optimized non-final callout lines with 15–41px right gaps and inherited 1px tracking. It also showed editor-height changes followed by stalled scroll positions; this is evidence for further investigation, not proof of a specific scroll-freeze cause. Private recordings are not bundled or published.
- Browser coverage extends mathematical callouts to 340/720/900px with 0/1px tracking and deliberately divergent fragment/final shaping metrics. Assertions inspect actual right edges, native copying, original formula/link identity, exactly one QED and full native restoration.
- Recording save coverage uses vault create/modify/read, verifies ordered checkpoints and visible `.md` paths, rejects mismatched readback, and permits retry with the retained report. Privacy sentinels remain excluded.
- TypeScript, 27 Node regressions, mobile bundle loading without Node/Electron and three-file release checks pass. ESLint retains zero errors and the two existing isolated-print DOM-helper recommendations.
- Full default browser/PDF regressions pass: 13 palette cases, 11 book pages, 19 valid internal links, no invalid links/overflow/print warnings, 34 optimized paragraphs without fallback, unchanged widow/orphan/Proof pagination and figure shrinking/floating/boundary/rollback coverage.
- Physical iPad acceptance is still required. No confirmed freeze fix is claimed.

# 2.13.2 Opt-in device layout diagnostics

- All 27 existing Node regressions pass; the two new diagnostic commands are registered on mobile and desktop. TypeScript, the release-bundle no-Node/no-Electron mobile host and three-file release checks pass. ESLint retains zero errors and the two existing isolated-print DOM-helper recommendations.
- Real browser tests distinguish native rectangles from optimized KP rows, measure visible non-final right gaps, and preserve paragraph HTML, the original formula node and native caret during sampling. Test-only private text, formula attributes, filename and block-ID sentinels never appear in saved reports.
- Passive touch capture leaves native gestures uncancelled and detects cancellation by a later handler. DOM mutation and fixed plugin work counters are observed without writing DOM. Immutable checkpoints, capped histories, retention of the first sample, automatic stop and complete listener/timer/trace cleanup are checked.
- The actual plugin Start/Stop methods are exercised with a vault adapter: initial, checkpoint and final writes remain ordered, share one vault-local export path and end with running=false. They neither change settings nor send data externally.
- Existing default-theme browser/PDF coverage passes: 13 palette cases, 11 book pages, 19 valid internal links, no invalid links or horizontal overflow, complete multi-page Proof text/math/references, exactly one final QED, and existing safe-figure/print-isolation checks. Phycat focused callout/diagnostic compatibility is also checked.
- Recording is disabled by default. This release adds an investigation workflow, not a verified fix for the user's remaining iPad freeze or irregular line edges. Physical iPad/WebKit and full Obsidian observations must come from a manually captured device report.

# 2.13.1 Proof alignment and editor ownership

- All 27 Node regressions pass. Emergency-fit tests sum real visible glue widths and verify that non-final lines exactly fill their target; short units without a flexible gap are rejected. TypeScript, mobile bundle loading without Node/Electron and three-file release checks pass. ESLint retains zero errors and the two existing isolated-print DOM-helper recommendations.
- Real Chromium callout fixtures at 340 and 720 pixels check each visible non-final right edge within two pixels, first-line title space, one final QED, original inline formulas/links, native copying and exact restoration. Offscreen assistive formula text is retained but cannot inflate width measurements.
- The actual plugin reading postprocessor is exercised before and after its fragment enters an editor. Reading refresh, pending disabled-controller work and unloading an old reader leave native title carets and Live Preview paragraph nodes untouched. Already-mounted editor fragments do not register reading controllers.
- Real CodeMirror regressions protect title/body nodes after blur while the native caret remains inside the callout. Reflow waits through a held touch, resumes after release, and preserves actual nonzero scrolling after editing. Synthetic passive touch tests cover pointer cancellation during native panning, momentum quiet time, coalescing, unrelated-editor touch events and listener/timer cleanup. Existing source-selection, IME, copying and source-preservation checks pass.
- Default, Phycat and Minimal browser/PDF checks cover 39 palette cases. Default/Minimal books have 11 pages and 19 valid internal links; Phycat has 13 pages and 35 links. There are no invalid internal links, horizontal overflows or new print warnings. Existing safe figure fitting/floating, rollback, cancellation and print isolation remain covered.
- Final print-window checks verify visible justification of every non-final optimized PDF line. Actual widow/orphan probes remain 24 + 2 and 28 + 11 lines. A long Proof spans 27 + 12 lines across two content pages, preserves math/references/text, and contains exactly one QED on the final page (extracted per-page counts 0, 0, 1). Rendered Proof boundary pages and the synthetic guide illustration were visually inspected.
- No dependencies, permissions or CSS rules are added. These regressions address concrete ownership and timing conflicts; they do not reproduce the full Obsidian/iPad WebKit host. Physical iPad verification of the reported restart-only scrolling freeze remains required.

# 2.13.0 Mathematical callout typography

- Twenty-seven Node regressions pass, including final-marker reservation and bounded emergency ragged lines. TypeScript, the simulated mobile bundle host and three-file release checks pass. ESLint has zero errors and retains the two isolated-print DOM-helper recommendations.
- Real Chromium fixtures at 340 and 720 pixels cover Proof/pf, Remark/rem, theorem and definition prose, reduced first-line width, own-line headings, exactly one final QED, original math/link identity, native copying and exact restoration. Unsupported tall floating titles keep native layout. Restoration preserves host-updated text instead of restoring stale content.
- Real CodeMirror checks cover a non-editable Proof widget, inert repeated refreshes, copying during width changes, native restoration on source-selection entry, editable-title caret ownership, reoptimization after leaving, disabling and extension removal. Markdown stays unchanged; no host errors occur. Existing plain-paragraph editing, hit-testing, IME and scroll checks remain covered.
- Default, Phycat and Minimal browser/PDF regressions pass across all 39 palette cases. Default/Minimal books have 11 pages and 19 valid internal links; Phycat has 13 pages and 35 links. There are no invalid links, horizontal overflows or new print warnings. Existing picture fitting, safe floating, round-limit rollback, cancellation and isolated-print security checks pass.
- Actual multi-page Proof probes retain all 39 lines (27 + 12), inline formulas and valid references. PDF text extraction finds no QED on earlier pages and one on the final page; rendered boundary pages and the synthetic Proof illustration were visually inspected. Existing widow/orphan fixtures remain 24 + 2 and 28 + 11 lines.
- Both usage guides and settings describe the expanded scope. No dependency, permission or CSS priority declaration is added. Physical iPad/WebKit and the full Obsidian host remain separate acceptance checks.

# 2.12.1 Progressive Live Preview typography

- The Linux GitHub Actions full suite also passes; asynchronous browser tests wait for completed editor measurements instead of assuming a fixed initial delay.
- Real CodeMirror/Chromium checks cover inactive Latin/CJK paragraph decoration, source-offset hit testing, immediate native restoration on caret entry and cross-paragraph selections, edits preserving surrounding source, IME composition, reoptimization after leaving, width changes, actual nonzero scrolling and disabled cleanup. Inline math/link paragraphs remain native.
- Twenty-five Node regressions, TypeScript, simulated mobile bundle loading and three-file release checks pass. ESLint has zero errors and retains the two isolated-print DOM-helper recommendations. Existing reading/PDF tests remain covered.
- Live Preview layout uses direct CodeMirror state-field decorations and deferred, stale-source-checked measurement effects. No editable text nodes are reparented, no Markdown content is changed, and no dependency or permission is added.
- Default, Phycat and Minimal full browser/PDF regressions pass. All 39 palette cases remain covered. Default/Minimal books have 12 pages and 19 valid internal links; Phycat has 13 pages and 35 links, with no invalid links or horizontal overflow. Actual widow/orphan probes, picture fitting, safe figure movement and rollback remain valid.
- The beta handles visible single-source-line plain paragraphs only; complex markup, multiline-source text and oversized notes remain native. Physical iPad/WebKit and the full Obsidian host remain separate acceptance checks.

# 2.11.0 Knuth–Plass paragraph typography (Beta)

- Twenty-five Node regressions pass. New tests prove lower whole-paragraph demerits than a feasible greedy fixture and cover glue/penalty widths, forced/forbidden breaks, first-line width, shrinking, short final lines, invalid measurements and bounded dense inputs. Existing numbering, references, diagrams, Proof, settings and PDF metadata tests remain covered; both new switches default to false.
- Real Chromium checks cover Latin/CJK grapheme layout, common punctuation constraints, nonbreaking joins/emoji, original link/math identity and listeners, exact node restoration, unchanged selected/copied text, responsive widths, deferred reflow during selections, font changes and zero idle mutation feedback. Editable DOM, unsupported markup, explicit breaks, indentation and oversized paragraphs remain native.
- Actual PDF line-position probes verify widow and orphan boundaries: 24 + 2 lines and 28 + 11 lines in the controlled Windows fixtures. All lines appear in order, every line fits, inline references remain valid, and measurement probes are absent from finished PDFs. The new inline line spans preserve native paragraph widow/orphan behavior. Exported paragraph and boundary pages were rendered and visually inspected.
- Default/Minimal illustrated books have 12 pages and 19 valid internal links; Phycat has 13 pages and 35 links. No invalid links or horizontal overflow are reported. All 39 palette cases pass across the three themes. PDF cancellation/failure cleanup, memory transport, blocked Node/file/network access, media fitting, safe figure movement, 80% shrinking and rollback remain covered.
- TypeScript, the simulated mobile release-bundle host and release checks pass. ESLint has no errors; its two native DOM-helper recommendations concern functions shared with the isolated print window. No runtime dependency or permission is added. Physical iPad/WebKit and the full Obsidian host remain separate acceptance checks.

# 2.10.0 Diagram LaTeX and triangular commutativity

- Twenty Node regressions cover TeX delimiters, marker topology and directed edges, non-collinearity, duplicate rejection, canonical round trips and pruning after node/arrow/grid removal. Existing numbering, references, Proof, settings and PDF metadata checks remain covered.
- Browser checks exercise actual MathJax SVG and CommonHTML output plus an unavailable native renderer. Bare alpha, dollar delimiters, LaTeX delimiters, fractions/subscripts, AMS blackboard bold and the tensor-product labels produce SVG paths without raw-command fallback, foreignObject or merror. Marker creation, touch selection, deletion, undo and dependent-arrow removal are covered. Responsive coordinates and namespaced glyph IDs remain checked.
- The fallback is bundled, has no network/installer/Node filesystem access, uses a private DOM handler and initializes only on demand. The release bundle loads and registers mobile commands in a simulated iPad host without initializing MathJax or loading desktop modules. TypeScript and release checks pass; the existing isolated print-window DOM-helper lint warning remains.
- Default-theme PDF tests pass with 12 pages, 18 valid internal links, no invalid links and no horizontal overflow. The exported diagram uses the CommonHTML fallback fixture; its formulas and short curved arrow were rendered and visually inspected. Existing figure floating priorities, 80% shrink, safe movement, environment boundaries and round-limit rollback pass. Phycat also passes all palette and PDF regressions with 13 pages, 30 valid internal links, no invalid links or horizontal overflow. Minimal passes the same regressions with 12 pages and 18 valid internal links. All 39 palette cases pass across the three themes.
- Physical iPad/Obsidian verification remains separate from Chromium and the simulated mobile host. Previous releases' validation entries below describe their historical dependency configurations.

# 2.9.0 Experimental figure layout and mobile diagrams

- Eighteen Node regressions cover figure/diagram shared counters, cross-file and book references, wrapper deduplication, ignored/invalid fences, caption validation and deletion of only owned adjacent anchors. TypeScript, mobile bundle loading and three-file release checks pass. ESLint retains the existing isolated print-window DOM-helper warning.
- Browser checks use real development-only MathJax SVG and CodeMirror. At 300/700-pixel widths, formulas and horizontal arrows retain their common viewBox coordinates; no foreignObject remains. Preview arrows are selectable, selected arrows and whole rendered diagrams can be removed, and unrelated text is preserved. Formula glyph IDs are unique across diagrams.
- Actual PDF boundary tests cover 80% shrinking, both priority orders, safe paragraph movement, oversized-paragraph rejection, environment boundaries, nested-figure exclusion and attempt-limit rollback. An enabled experiment also passes book TOC calibration. Probe annotations are absent from finished PDFs and internal links remain valid.
- Default, Phycat and Minimal runs pass all 39 palette cases and PDF/layout regressions. Default/Minimal illustrated books have 12 pages and 18 internal links; Phycat has 13 pages and 30 links. No invalid links or horizontal overflow were reported. The diagram page and shrink/move/fallback pages were rendered for visual inspection.
- PDF print isolation, blocked Node/file/network access and cancellation/failure cleanup remain covered. No runtime dependencies were added. Physical iPad/Safari and the actual optional TikZJax compiler remain separate acceptance checks.

# 2.8.0 Proof, diagrams and pagination

- Fifteen Node regressions pass, including compact Proof references, own-line headers, cross-chapter numbering, diagram JSON validation, quoted fences and endpoint pruning. TypeScript and ESLint pass with the existing isolated print-window DOM-helper warning.
- Browser tests cover dropdown focus suppression while preserving scroll, actual CodeMirror title/caret/scroll behavior, clickable diagram editing, undo and saving. Math labels are checked with a real development-only MathJax SVG renderer, including the tensor-product example.
- TikZ integration tests simulate asynchronous SVG completion, missing-plugin and timeout errors, and glyph-reference isolation. The actual optional TikZJax compiler has not been exercised locally.
- Native Electron PDF checks include an oversized picture and caption boundary probes: both must land on the same page, with one scaled group and no remaining oversized groups. Default/Minimal output has 12 pages/17 internal links; Phycat has 13 pages/25 internal links. All 39 palette cases pass. No invalid links or horizontal overflow were reported. PDF diagram and scaled-picture pages were rendered and visually inspected.
- The built plugin loads in a simulated mobile host without Node or Electron imports. Actual Obsidian and physical iPad menu behavior remain separate acceptance checks.

# 2.7.1 settings and Live Preview stability

- Browser regressions exercise repeated motif choices, color toggles, environment switching and reset. They require the settings scroll position and focused control to survive, and unrelated settings DOM to remain unchanged.
- Actual CodeMirror regressions use a native-style callout widget with an editable title. Repeated refreshes must preserve its text node and caret; after editing ends, numbering resumes and scrolling remains stable. Unchanged callout and figure decoration must produce zero DOM mutations.
- The reported iPad issue requires restarting Obsidian 1.13.7 to recover. These tests cover a concrete DOM/selection feedback path, but do not reproduce the full Obsidian iPad host. Physical iPad verification is still required.
- TypeScript and ESLint pass with the existing isolated print-window DOM-helper warning. Thirteen Node regressions and the built-plugin mobile smoke test pass. Native Electron verification passes 13 palettes and a ten-page PDF with 17 valid internal links, no invalid links and no horizontal overflow.

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
