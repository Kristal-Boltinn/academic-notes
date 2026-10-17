# Academic Notes

**English** | [简体中文](README.zh-CN.md)

Academic writing for Obsidian: mathematical environments, automatic numbering, cross-references, diagrams, and publication-style exports.

Inspired by [ElegantBook](https://github.com/ElegantLaTeX/ElegantBook), Academic Notes brings framed theorems, borderless proofs with an end-of-proof square, and understated colored remarks to your notes.

[User guide](https://github.com/Kristal-Boltinn/academic-notes/wiki) · [Latest release](https://github.com/Kristal-Boltinn/academic-notes/releases/latest) · [Changelog](CHANGELOG.md)

![Theorems and definitions in Academic Notes](screenshots/theorem.png)

## Mathematics with structure

- **Mathematical environments** — theorems, definitions, lemmas, propositions, proofs, remarks, and more, with support for folding and nesting.
- **Flexible numbering** — automatic or manual numbers, section-based or continuous counters, shared theorem counters, and an option to number only referenced equations.
- **Cross-file references** — readable labels, reference suggestions, customizable names and abbreviations, and links that follow their targets into a PDF book. Display equations also accept LaTeX `\label`, `\eqref`, and `\ref` syntax, with clickable `\eqref` links and per-row numbering in multi-line environments.
- **Your own environments** — add named environments with their own numbering, references, colors, and corner motifs.

[Explore mathematical environments](https://github.com/Kristal-Boltinn/academic-notes/wiki/Mathematical-environments) · [References and indexes](https://github.com/Kristal-Boltinn/academic-notes/wiki/References-and-indexes)

## Algorithms, figures, and diagrams

Algorithms use the familiar pseudocode.js / LaTeX algorithmic grammar, with a three-line layout, optional line numbers, automatic numbering, and cross-references. Both callout and code-block forms use the same renderer.

![A numbered algorithm with mathematical notation](screenshots/algorithm.png)

Figures, subfigures, and three-line tables have coordinated captions and references. Subfigure groups support shared image heights and balanced layouts. The built-in commutative diagram editor **(Beta)** provides grid-based nodes, math labels, arrows, and triangular commutativity markers. Optional TikZJax integration preserves completed drawings in exports.

[Algorithms](https://github.com/Kristal-Boltinn/academic-notes/wiki/Algorithms) · [Figures and tables](https://github.com/Kristal-Boltinn/academic-notes/wiki/Figures-and-tables) · [Diagrams and TikZ](https://github.com/Kristal-Boltinn/academic-notes/wiki/Diagrams-and-TikZ)

## An appearance of your own

Choose coordinated light and dark palettes, follow your Obsidian theme's accent, or create a custom palette. Each palette keeps its own environment colors and motifs. Share palettes, custom environments, and reference formats through profiles with an import preview and conflict choices.

![Forest, Sakura, and Colorful palettes](screenshots/palettes.png)

Optional paragraph indentation and Knuth–Plass line breaking **(Beta)** refine supported paragraphs in Reading view, inactive Live Preview, and desktop PDF export. Active editing and unsupported content retain native layout.

[Appearance and customization](https://github.com/Kristal-Boltinn/academic-notes/wiki/Appearance-and-customization) · [Paragraph typography](https://github.com/Kristal-Boltinn/academic-notes/wiki/Typography)

## Navigate, check, and publish

- **Linked Markdown indexes** — collect academic content by environment or source note into an ordinary note, with clickable links and refreshable contents.
- **Reference checks** — find missing or ambiguous targets, duplicate block IDs, numbering conflicts, and references outside a selected book.
- **Contents and PDF navigation** — clickable tables of contents, bookmarks, measured page numbers, and internal links.
- **Single notes and books** — export HTML snapshots or desktop PDFs, combine chapters, and renumber the export without rewriting source notes.
- **Page-aware figures** — keep images and captions together, with optional experimental shrinking and limited paragraph movement to reduce page gaps.

![A multi-note book exported to PDF](screenshots/book-export.png)

[Contents and export](https://github.com/Kristal-Boltinn/academic-notes/wiki/Contents-and-export)

## Desktop and mobile

Requires **Obsidian 1.9.0 or later**. Mathematical environments, numbering, references, indexes, appearance tools, and HTML snapshots work on desktop and mobile. **PDF export is desktop-only**, using Obsidian's bundled Electron; no separate export engine is required. The interface follows Obsidian's language, with English and Simplified Chinese available.

Beta features have documented scope limits; layout and touch behavior can vary by device and theme. See the [user guide](https://github.com/Kristal-Boltinn/academic-notes/wiki) for compatibility details.

## Local processing and privacy

Indexing, diagram rendering, and exports run locally, with no telemetry or developer account. Exported files stay in the vault. Theme capture may read loaded styles, fonts, and images, including theme resources outside the vault; optional integrations have their own behavior. See [Privacy and permissions](https://github.com/Kristal-Boltinn/academic-notes/wiki/Privacy-and-permissions) for resource access, note edits, and diagnostic reports.

## Documentation

Installation, syntax, settings, and examples live in the **[Wiki](https://github.com/Kristal-Boltinn/academic-notes/wiki)**, with a **[中文指南](https://github.com/Kristal-Boltinn/academic-notes/wiki/Home-ZH)** alongside it.

[Getting started](https://github.com/Kristal-Boltinn/academic-notes/wiki/Getting-started) · [Troubleshooting](https://github.com/Kristal-Boltinn/academic-notes/wiki/Troubleshooting) · [Development](https://github.com/Kristal-Boltinn/academic-notes/wiki/Development)

## License

[MIT](LICENSE). Dependency licenses and acknowledgments are in [Third-party notices](THIRD-PARTY-NOTICES.md).

## Support and feedback

If Academic Notes is useful to you, please consider [starring the project](https://github.com/Kristal-Boltinn/academic-notes). Bug reports and feature suggestions are welcome in [GitHub Issues](https://github.com/Kristal-Boltinn/academic-notes/issues).
