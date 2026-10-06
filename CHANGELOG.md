# 2.15.0

- Add numbered algorithms with equivalent `algorithm` fences and `[!algorithm]` callouts using locally bundled pseudocode.js; share independent counters, block IDs, cross-file references and book renumbering. Add optional line numbers, bilingual settings and insertion templates.
- Retain traditional three-rule pseudocode styling, neutral math/body text, and complete-row PDF pagination; keep algorithm callouts independent of Phycat theme frames.
- Add multilingual environment names, abbreviations and formats, plus user-defined Markdown environments with existing box/Remark styles, numbering, templates and cross-file/PDF references.
- Group settings into four tabs and one environment/reference editor. Remove duplicate figure/table/algorithm/equation format controls, preserve saved formats, and show their inherited defaults. Preserve control scrolling and native picker behavior.
- Store colors and motifs independently per palette, migrate earlier overrides to the selected presets, and add custom copies, single-environment reset and whole-palette reset.
- Give each built-in preset a coherent family of its named hue. Apply preset colors at runtime as well as in CSS to protect against later legacy/theme color rules; show the complete palette and the current light/dark mode.
- Match algorithm rules and captions to the palette’s primary accent, retaining neutral body text.
- Center sized figure images in Reading and native Live Preview wrappers, including asymmetric CodeMirror padding, without changing source text.
- Treat prose immediately after display math as a continuation; require an empty source line to restart the optional first-line indent, including Proof and equation block IDs.
- Include theme letter/word spacing in Live Preview KP measurements, with a bounded fallback for older WebKit. Preserve active typing, selection, IME and editor ownership.
- Update English and Chinese usage guides, synthetic examples, screenshots and tests. Consolidate the previously separate 2.15/2.16/2.17 releases under 2.15.0 at the maintainer’s request. Install this consolidated release manually if a device already has 2.16/2.17, because automatic updates do not downgrade versions.

# 2.14.1

- Put first-line indentation inside the full outer width of a generated KP row. The solver reserves only its text area; explicit zero text-indent on owned rows prevents inherited indentation from adding another offset.
- Make the prose-indent option override mathematical-callout default indentation while keeping native paragraph restoration intact.
- Measure actual first glyph positions and non-final right edges in indented Reading/Live Preview prose and mathematical callouts; retain PDF indentation/pagination coverage.

# 2.14.0

- Add optional visual 2em first-line prose indentation across Reading view, Live Preview and exports; default off and independent of KP.
- Trim theme end margins in formula-ending optimized rows while retaining original math nodes and exact restoration.
- Allow inactive read-only callout bodies to optimize when their native titles retain editable attributes. Preserve active title/body selections, IME and touch guards.
- Keep active or unsupported Live Preview prose browser-justified when its KP option is enabled. Source mode, lists and code retain native styling.
- Record bounded numeric solver/calibration results in opt-in layout diagnostics. Physical iPad scrolling recovery remains unverified.

# 2.13.3

- Save layout recordings as visible Markdown notes containing JSON, using vault create/modify APIs and readback verification. Add in-app View recording and Open saved report buttons, retain the report for retry after a failed save, and preserve the original active note when starting from the diagnostic dialog.
- Calibrate each rendered non-final KP line against its actual right edge after applying the solver's spacing. Distribute only small residuals through existing flexible gaps, retain original breaks/formula/link nodes and the natural final line, and fall back to native layout when calibration is unsupported.
- Extend synthetic browser coverage to 340/720/900px callouts with 0/1px tracking and divergent measurement/shaping metrics. Add vault creation/update/readback-failure/retry coverage.
- Record viewport changes and anonymous hit targets, and classify outside-note touch events during manual recording. No note text or source is recorded.
- Remaining physical iPad scrolling failures are not claimed fixed; the device recording shows keyboard/editor-height changes, requiring further device verification.

# 2.13.2

- Add opt-in local layout/scroll diagnostics for iPad and desktop: 90-second recordings, initial and 15-second vault checkpoints, automatic stop and manual Stop/Save commands.
- Record visible callout/native/KP geometry, font and scroll CSS, right-edge gaps, selection/touch/scroll state, downstream event prevention, mutation counts and fixed plugin layout trace codes.
- Exclude note text, formulas, file names, block IDs, HTML, input values and error messages. No remote upload or automatic recording. Keep bounded histories and clean up listeners on stop/unload.
- Add real browser privacy, geometry, passive-event, checkpoint ordering and cleanup coverage. Document the workflow in English and Chinese.
- Paragraph rendering and KP defaults are unchanged. The remaining iPad scrolling and typography issues need device reports; this release does not claim to fix them.

# 2.13.1

- Fix ragged non-final Proof and other mathematical-callout lines in the emergency KP pass: distribute the required width into visible gaps and score the actual spacing. Paragraph-final lines retain natural spacing.
- Measure inline formula boxes without offscreen accessibility descendants inflating their widths. Preserve original math nodes, links, copying and Markdown.
- Keep reading postprocessors and pending reading controllers away from Live Preview editor fragments, including fragments moved into the editor after rendering.
- Protect the entire callout while a native caret remains inside it, even after focus or contenteditable changes. Defer editor layout during touch gestures and momentum scrolling; remove passive listeners on cleanup.
- Add real postprocessor ownership, retained-caret, cancelled-touch, scroll-settling and visible right-edge regressions. Update both usage guides. Physical iPad verification remains a separate acceptance check.

# 2.13.0

- Extend optional Knuth–Plass typography to Proof, Remark and other mathematical callout bodies in Reading view, read-only Live Preview widgets and desktop PDF export.
- Reserve first-line width for inline titles and last-line space for exactly one Proof QED. Preserve inline formulas, links, native copying and source text; allow bounded ragged emergency lines when indivisible math cannot be fully justified.
- Keep active callouts and editable titles native. Defer reflow during copying, skip unchanged widgets, and restore original content on disable or extension removal.
- Update English/Chinese settings and usage guides with a synthetic Proof illustration. Add narrow/wide callout, real CodeMirror and multi-page Proof PDF regressions. No dependency or permission is added.

# 2.12.1

- Add an independent, off-by-default Live Preview Knuth–Plass switch for inactive standalone plain paragraphs. Caret entry and intersecting selections restore native layout synchronously; leaving reoptimizes visible prose.
- Use official CodeMirror decorations while retaining original source text and source-position mapping. Defer measured updates until editor updates finish, discard stale source measurements, and restore native layout throughout IME composition.
- Bound scanning and layout work; preserve native rendering for inline syntax, environments, lists, multiline-source paragraphs and unsupported typography. Recalculate on widths, fonts and theme changes.
- Document the scope in both usage guides and add real CodeMirror editing, hit-testing, selection, composition and scroll regressions. No dependency or permission is added.

# 2.11.0

- Add optional independent Knuth–Plass paragraph line breaking in Reading view and desktop PDF export. Both switches are off by default; Live Preview, source editing and HTML snapshots retain native layout.
- Optimize measured Latin/CJK paragraph breaks and flexible gaps, preserve inline links and math, and reflow after width/font changes. Unsupported and oversized paragraphs fall back to browser layout under strict work limits.
- Restore original render nodes on disable/unload, protect editable DOM and selections, and retain print isolation and figure-layout safeguards.
- Document usage and limitations in English and Chinese; add global-optimization, DOM identity, responsive-layout and actual-PDF regressions. No runtime dependency or permission is added.

# 2.10.0

- Fix raw diagram LaTeX labels when the host math renderer returns CommonHTML or fails: use a private bundled TeX/AMS-to-SVG fallback, retaining the shared SVG coordinates and local glyph references. Accept bare TeX, dollar delimiters and LaTeX inline/display delimiters.
- Add triangular commutativity markers: connect the two-step path and direct arrow, then select source, intermediate node and target. Render a short quarter-circle arrow inside the triangle, with touch selection, deletion, undo and export support.
- Validate marker topology and remove dependent markers when nodes, arrows or grid positions are removed. Keep existing version-1 diagram data compatible.
- Update both usage guides, the tensor-product illustration and dependency notices. No network, installer or filesystem capabilities are added.

# 2.9.0

- Add experimental desktop PDF figure layout priorities: shrink visuals to 80%, advance a safe prefix of following paragraphs, or retain page gaps. Bound total attempts and restore normal layout on exhausted attempts or failed final validation/calibration. Source notes and numbering remain unchanged.
- Render commutative-diagram formulas and arrows in one SVG coordinate system to address mobile positioning. Add touch-sized arrow selection targets and direct rendered diagram deletion without switching to source mode.
- Share Figure numbering and cross-file/book references between standalone diagrams and pictures; retain enclosing figure/subfigure numbering without duplicate counts. Add optional diagram captions and unique block IDs for newly inserted diagrams.
- Extend bilingual documentation, synthetic examples, actual-PDF layout checks and browser regressions. Preserve existing mobile support and print-window isolation.

# 2.8.0

- Close appearance dropdowns after selection without losing the settings scroll position.
- Resolve Proof header references to theorem/lemma/claim type and number, including compact `[!proof][[...]]` syntax. Empty Proof headers occupy their own line; an empty quoted line explicitly separates named headers from the body.
- Add a local commutative diagram editor (Beta): clickable 2×2/3×3 grids, native MathJax node and arrow labels, straight solid/dashed arrows, label placement and undo. Save diagrams as editable `academic-diagram` code blocks in notes.
- Add an optional TikZJax template and export integration. Wait for static SVG, isolate glyph IDs between chapters and report missing or unfinished rendering before export.
- Keep figures, subfigure groups and captions together when they fit a page. Scale oversized visuals proportionally for A4 printing; source order is retained without automatic float reordering.
- Expand bilingual usage guides, synthetic examples and browser/PDF regression coverage.

# 2.7.1

- Keep the settings page at its current scroll position and retain control focus when choosing motifs, switching environments, enabling colors or resetting appearance.
- Leave editable Live Preview titles to Obsidian, defer decoration during IME composition, and avoid redundant DOM writes and self-triggered refreshes. This addresses a possible repaint/selection feedback path behind the reported iPad scrolling freeze.
- Add browser and real CodeMirror regression coverage for settings interactions, native title ownership, caret retention and scrolling after editing.
- Add GitHub star and issue invitations to both README translations.

# 2.7.0

- Enable the existing plugin on iPad and other Obsidian mobile devices for numbering, cross-file references, academic callouts, settings and HTML snapshots.
- Load Electron only inside guarded desktop PDF actions. PDF commands remain on desktop; the mobile diagnostic reports the platform limitation without loading Node or Electron modules.
- Add a release-bundle mobile smoke test and preserve the existing desktop PDF workflow.

# 2.6.0

- Add independent light/dark accent and corner-motif color overrides for each mathematical environment, with automatic title contrast and per-environment reset.
- Add nine original vector corner motifs with a settings gallery and live preview; retain original designs by default and allow individual motifs to be hidden.
- Add optional Style Settings controls for motif size and opacity alongside border width and corner radius. Preserve unframed Proof/Remark and the QED square.
- Preserve custom appearance in PDF snapshots and restore pre-existing inline variables when unloading the plugin.

# 2.5.1

- Untitled, unreferenced subfigures no longer show a letter, reserve caption space or consume a subfigure letter. Existing IDs remain available; referenced or manually numbered subfigures retain labels.
- Preserve explicitly written captions such as "Subfigure" instead of treating them as native placeholder titles.
- Keep explicit folding controls usable in notes and omit empty captions in PDF export. Add parser and real Chromium rendering regressions.

# 2.5.0

- Add the bilingual Insert academic environment command with theorem, definition, proof, remark, figure, table and 2–12-subfigure templates, unique per-note IDs and title selection.
- Add figure-level `cols=auto|1|2|3|4` and `height=180` options, compatible with manual and suppressed numbering. Four-column groups switch directly to two columns; shared image heights scale down together when necessary, preserving aspect ratios without cropping.
- Include optional LaTeX Suite text snippets and expanded usage guides.
- Test responsive layouts, mixed image ratios, generated references and forward/backward cross-chapter theorem links in PDF export.

# 2.4.0

- Follow Obsidian’s language for Chinese and English settings, commands, dialogs, diagnostics and export messages; use English for other locales. Existing settings and note syntax remain compatible.
- Consolidate callout styling with shared variables and reduce redundant CSS priority overrides while preserving theme compatibility.
- Preserve three-line table styling during Live Preview hover and keep subfigures side by side in PDF exports.
- Extend regression coverage for localization, editable tables and illustrated PDF books.

# 2.3.0

- Display proofs as plain paragraphs with an inline italic title and one automatic hollow QED square at the end, including proofs spanning PDF pages.
- Display remarks without a frame or background, using a brighter title color from the selected palette in light and dark mode.
- Consolidate mathematical callout styles, separate plugin UI styles, narrow print selectors, and remove redundant priority overrides and pagination rules. Build the release stylesheet and snapshot styles through the same CSS compiler.
- Credit ElegantBook as the visual inspiration in both READMEs; add proof/remark usage, screenshots, and a synthetic example note.
- Extend Electron checks for aliases, nested and folded environments, theme compatibility, palette-matched remarks, and long proofs in PDF export.

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
