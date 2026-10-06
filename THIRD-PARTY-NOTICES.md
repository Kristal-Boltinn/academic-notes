# Third-party notices

## Bundled runtime dependencies

- pseudocode 2.4.1 — MIT, copyright Saswat Padhi and Tate Tian. Its Lexer/Parser grammar is bundled; Academic Notes supplies its own DOM rendering, math, numbering and styles. https://github.com/SaswatPadhi/pseudocode.js

KaTeX and the upstream HTML renderer are not bundled; formulas use Obsidian and the existing local MathJax fallback.

- mathjax-full 3.2.2 — Apache-2.0, MathJax Consortium. A private TeX/AMS input and SVG output fallback, including its TeX glyph data, is bundled for commutative diagrams. https://github.com/mathjax/MathJax-src
- pdf-lib 1.17.1 — MIT, copyright Andrew Dillon. https://github.com/Hopding/pdf-lib
- @pdf-lib/standard-fonts 1.0.0 — MIT. https://github.com/Hopding/standard-fonts
- @pdf-lib/upng 1.0.1 — MIT, based on UPNG.js by Photopea. https://github.com/Hopding/upng
- pako 1.0.11 — MIT AND Zlib. https://github.com/nodeca/pako
- tslib 1.14.1 — 0BSD, Microsoft Corporation. https://github.com/microsoft/tslib

Complete license texts for bundled dependencies are in `licenses/` and preserved in the generated bundle's legal notices. See package-lock.json for exact resolved dependencies.

## Host and development tools

Obsidian provides its own API and native math renderer; Obsidian is not redistributed here. The independent bundled MathJax fallback listed above does not change the host renderer. Electron's host runtime is provided by Obsidian. The separate Electron npm dependency is used only for development tests and is not bundled into the plugin. Electron, esbuild, TypeScript and the Obsidian type definitions retain their own licenses in their npm packages.

Browser regressions also use MathJax 3.2.2 to exercise both SVG and CommonHTML host output. The bundled fallback uses the base, AMS, newcommand and configmacros packages; test-only packages and the CommonHTML renderer are excluded from the installed plugin. The optional TikZ integration delegates rendering to the user's installed TikZJax plugin; no TikZJax code is bundled.

Examples and test drawings in this repository are synthetic and distributed under this project's MIT license. User notes, local settings, fonts and exported documents remain outside the software license.
