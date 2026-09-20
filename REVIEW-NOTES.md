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
