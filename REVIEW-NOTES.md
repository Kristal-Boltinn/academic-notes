# Community review follow-up: 2.7.1

- Restrict appearance settings redraws to their own section and preserve scroll/focus.
- Skip editable editor DOM and composition, make decoration writes idempotent, and disconnect the plugin observer during its own rendering pass.
- No new dependencies, CSS rules, network access or filesystem capabilities. Physical iPad verification remains separate from browser/CodeMirror regression coverage.

# Community review follow-up: 2.7.0

- `isDesktopOnly` is false so Obsidian can offer the existing plugin on mobile. PDF commands are registered only on desktop. The PDF runtime uses `Platform.isDesktopApp` before its dynamic Electron require; there are no top-level Electron or Node imports in the distributable plugin.
- The published `main.js` is evaluated in a simulated iPad host that throws if Electron or Node is loaded. Desktop PDF output remains covered by the existing Chromium regression.
- The plugin continues to use Obsidian vault APIs. No new network or filesystem access is introduced.

# Community review follow-up: 2.6.0

- Per-environment CSS overrides accept only known environment IDs, six-digit hex colors and bundled original SVG motif IDs. No external SVG or user-supplied CSS is accepted.
- Custom properties remain scoped to plugin callouts and are restored on unload. No additional !important declarations, dependencies, network or filesystem capabilities are introduced.
- Added mock settings tests and native Chromium/PDF regressions; the next Community Directory scan and real Obsidian UI acceptance remain separate checks.

# Community review follow-up: 2.5.1

- Hide unneeded subfigure captions through a scoped variable in the existing caption rule, without additional !important declarations. Preserve actual references, explicit numbering and interactive folding controls.
- No new network, filesystem or dependency capabilities are introduced.

# Community review follow-up: 2.5.0

- Figure-specific container queries select responsive column counts without resize polling. Four-column layouts intentionally bypass three columns.
- Validated numeric figure metadata controls shared image height; intrinsic image ratios cap the whole group's height without cropping or stretching. This overrides per-image width only for explicitly configured groups. Three scoped priority declarations were added for theme and embed-width compatibility (64 total in released styles.css).
- New insertion commands modify the current editor only when invoked, preserve existing text and allocate per-note unique block IDs. Optional snippet examples do not execute within the plugin.
- No new network or filesystem capabilities are introduced.

# Community review follow-up: 2.4.0

- Shared callout variables replace repeated geometry and title overrides. Reduced released CSS priority declarations from 130 to 61; total CSS occurrences including sources fell from 326 to 170. Retained table hover overrides are covered against Phycat and Minimal.
- Export layout now excludes subfigure grids from the generic block-content reset. Tests include parallel figures and three-line tables in actual PDFs.
- English and Chinese interfaces follow Obsidian's language through its public API. Localization does not change command IDs, settings values or user content, and isolated print messages are passed explicitly into the print window.
- Scoped MathJax, pagination and theme compatibility rules remain. No scanner suppression was added; the previous explanations below still apply to those remaining findings.

# Community review follow-up: 2.3.0

## CSS cleanup and appearance

- Consolidate mathematical callout rules with CSS nesting; esbuild expands them for both styles.css and snapshot CSS. Move plugin controls and offscreen-stage styles into ui.css. Narrow mathematical print rules to supported environments and consolidate export pagination rules.
- Reduce !important declarations in released styles.css from 219 to 130. Remove unnecessary priority overrides from shared typography, private grid cells and pagination; retain targeted overrides for properties actually forced by themes and the hidden rendering stage. Compatibility tests include the actual installed Phycat and Minimal stylesheets. This reduces scanner noise without claiming every CSS warning is resolved.
- Proof and remark now use borderless paragraph layouts. Proofs end with one QED marker; remark titles follow the selected palette. Native PDF tests cover a multi-page proof and retain all print-window isolation checks.
- Both READMEs link to ElegantBook as the visual inspiration and document the new environments with rendered examples.

The filesystem, native DOM helper, MathJax and browser-compatibility notes below still apply. No scanner rules are disabled to hide findings.

# Community review follow-up: 2.2.3

## Changes responding to the supplied 2.2.2 report

- Direct filesystem access has been removed from the installed plugin. PDF export loads a small fixed shell, creates a Blob inside the sandboxed print window, and navigates to that short Blob URL. The full HTML never becomes a data URL. No temporary HTML file is written outside the vault, and release validation rejects Node fs imports in the bundle.
- The exporter enforces a restrictive CSP before snapshot content is parsed. The isolated session blocks network and file requests, denies permission requests, and disables Node integration. Window cleanup covers success, cancellation and failures.
- The TOC and snapshot builder execute in Obsidian and now use that document window's createEl/createDiv/createSpan helpers. Electron tests provide minimal mocks for these helpers.
- README links and release-verification examples now point to Kristal-Boltinn/academic-notes. Both READMEs explain the memory-based PDF export and remaining local resource access.
- The supplied page includes historical 2.2.1 failures below the passing 2.2.2 scan. Its latest scan confirms release attestations and byte-for-byte build reproduction; the older license and source-code failures are not new findings. LICENSE retains the standard MIT text and the release workflow continues to attest all three assets.

## Retained capabilities and warnings

- Vault enumeration: local cross-note references and referenced-only equation numbering require the Markdown index. Configured excluded paths are filtered before reading. No index is transmitted.
- One native DOM creation warning remains in the serialized print function: its sandboxed Chromium window does not provide Obsidian's createDiv helper. The warning remains visible; it is not suppressed or hidden behind another API.
- CSS custom elements: mjx-container and mjx-assistive-mml are real MathJax elements required for formula layout and hiding duplicate assistive markup in print.
- CSS compatibility: the scan groups ordinary text-indent and page-fragmentation properties under partially supported browser features, using an Obsidian 1.7.4 baseline. The plugin requires 1.9.0. The declarations use simple indentation, page breaks and prefixed box-decoration-break; removing them would change indentation, split formulas or lose repeated box decoration. Current Electron layout is covered by tests, not a claim of testing every older installer.
- CSS !important: the retained scoped theme overrides preserve callout geometry, captions, three-line tables and captured-theme printing. Wholesale removal would change supported theme behavior. No CSS lint rules are disabled to conceal these warnings.
- Snapshot collection still embeds already loaded local theme fonts/images through Chromium's local-resource APIs, as disclosed in both READMEs. Removing Node fs does not turn the whole Obsidian plugin environment into a permission sandbox. Notes and final outputs use the vault API.

## Validation and release status

See VALIDATION.md for local checks. The release workflow repeats tests, checks build reproducibility and creates attestations. The official scan must examine the new release to update its findings; passing automated checks is separate from Community Directory approval.
