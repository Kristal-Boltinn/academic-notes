# Third-party notices

## Bundled runtime dependencies

- pdf-lib 1.17.1 — MIT, copyright Andrew Dillon. https://github.com/Hopding/pdf-lib
- @pdf-lib/standard-fonts 1.0.0 — MIT. https://github.com/Hopding/standard-fonts
- @pdf-lib/upng 1.0.1 — MIT, based on UPNG.js by Photopea. https://github.com/Hopding/upng
- pako 1.0.11 — MIT AND Zlib. https://github.com/nodeca/pako
- tslib 1.14.1 — 0BSD, Microsoft Corporation. https://github.com/microsoft/tslib

Complete license texts for bundled dependencies are in `licenses/` and preserved in the generated bundle's legal notices. See package-lock.json for exact resolved dependencies.

## Host and development tools

Obsidian provides its own API and math renderer; neither Obsidian nor MathJax is redistributed here. Electron's host runtime is provided by Obsidian. The separate Electron npm dependency is used only for development tests and is not bundled into the plugin. Electron, esbuild, TypeScript and the Obsidian type definitions retain their own licenses in their npm packages.

Browser drawing regressions use mathjax-full 3.2.2 (Apache-2.0), with its license retained in the npm package. This development dependency supplies real SVG formula layout for tests and is excluded from the installed plugin. The optional TikZ integration delegates rendering to the user's installed TikZJax plugin; no TikZJax code is bundled.

Examples and test drawings in this repository are synthetic and distributed under this project's MIT license. User notes, local settings, fonts and exported documents remain outside the software license.
