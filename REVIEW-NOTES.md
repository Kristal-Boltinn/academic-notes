# Community review follow-up: 2.2.2

## Changes responding to the supplied 2.2.1 report

- LICENSE contains the standard MIT text. Dependency and user-content notices stay in THIRD-PARTY-NOTICES.md. GitHub license detection must be checked after pushing.
- Release builds generate attestations for main.js, styles.css and manifest.json using actions/attest. Attestations exist only after the GitHub workflow succeeds, not merely after committing its configuration.
- TOC content is copied as DOM nodes, including remapped SVG glyph IDs; no innerHTML assignment remains.
- Print background and glyph-cache layout use static CSS. Settings headings use Setting.setHeading().
- Core records, plugin state, editor integration, export, and UI have explicit types. noImplicitAny is enabled. CodeMirror dependencies are declared and remain external in the plugin bundle.
- Settings definitions expose controls to Obsidian 1.13 search, with imperative display retained for older supported hosts.
- Local image URLs are restricted to app/file/blob (data images are already embedded). Chromium fetch handles these local schemes; requestUrl is intended for HTTP and cannot replace this resource-loading path.

## Necessary capabilities and remaining recommendations

- Direct filesystem access: src/export/pdf.ts creates one unique academic-notes-* directory under the OS temporary directory, exclusively writes document.html, and removes that directory in finally. POSIX file mode is 0600; Windows access is governed by the user's temporary-directory ACL. No arbitrary directory enumeration or system-file reading uses Node fs. A crash may leave the print snapshot behind. Notes and final exports use the Obsidian vault API. README documents this behavior.
- Vault enumeration: local cross-note references and referenced-only equation numbering require the Markdown index. Configured excluded paths are filtered before reading. No index is transmitted.
- Native DOM creation recommendations remain in the shared document renderer and serialized print function: these also run in isolated Chromium without Obsidian's createEl helpers. These warnings are left visible, not suppressed. Native Obsidian UI uses its helpers.
- CSS recommendations: mjx-container and mjx-assistive-mml are MathJax custom elements. text-indent and box-decoration-break have fallbacks (including the WebKit-prefixed form). Scoped !important rules protect academic layout and printing from captured theme styles. Removing them wholesale would change rendering. These are review recommendations, not source-code errors.

## Validation and release status

See VALIDATION.md for local checks. These changes do not establish Community Directory approval. Publishing 2.2.2, verifying cloud attestations and rerunning the official scan remain separate release steps.
