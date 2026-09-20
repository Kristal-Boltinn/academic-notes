# Release and submission

1. Confirm the public author identity and the unique `academic-notes` ID / Academic Notes name in the Community Directory. The generic contributors author is intentional until a public identity is chosen.
2. Run `npm ci`, `npm test`, `npm run build`, `npm run test:electron`, `npm run check:release`. On Linux the Electron test requires a display (CI uses `xvfb-run`).
3. Install only the three built release files into a test vault as `academic-notes`. Verify plugin enable/disable, source vs Live Preview, scrolling/nesting, references, theme switches, single-note PDF and a multi-note book, including long formulas, fonts and images.
4. Update version metadata and CHANGELOG. Commit source and package-lock.json. Never commit data.json, node_modules, output/, a real vault, local executable paths or personal test documents.
5. Push the version tag without a `v` prefix. The workflow rejects mismatches and creates a draft GitHub Release with main.js, manifest.json and styles.css. Inspect its assets, then publish manually.
6. Sign in to the Obsidian Community Directory, link the repository, run its available review/preview scan, resolve actual findings, and submit. Local checks do not predict approval.

References verified 2026-09-20:

- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin)
- [Manifest requirements](https://docs.obsidian.md/Reference/Manifest)

This repository's automation does not create a repository, publish a public release or submit to the Community Directory by itself.
