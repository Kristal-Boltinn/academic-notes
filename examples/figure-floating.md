---
title: Experimental PDF figure layout
tags: [academic-notes, example]
---

# Experimental PDF figure layout

On desktop, choose a Figure layout priority under Academic Notes settings and export this note as PDF. The default preserves source order. Exact page gaps depend on fonts, theme, and the paragraphs you add above the picture. To compare priorities, add ordinary paragraphs until the picture moves to the next page while leaving a gap.

## A standalone figure

A figure whose 80% dimensions fit in the remaining space can stay on this page. Otherwise, the following ordinary paragraph may advance while the complete picture and caption remain on the next page.

> [!figure] A synthetic mathematical picture
> ![[assets/curve-a.svg]]

^fig-layout

This ordinary paragraph is allowed to precede the picture in the experimental PDF copy. The original note keeps its order, and the Figure number stays the same. See [[#^fig-layout]].

> [!remark] A boundary
> This mathematical environment is never advanced to fill the gap. A picture never moves inside it.

## A nested figure

> [!proof]
> This figure belongs to the proof and never floats outside it.
>
> > [!figure] A nested picture
> > ![[assets/curve-a.svg]]
>
> This sentence belongs to the proof.

Use Maximum figure adjustment attempts to limit the whole export. If further attempts would exceed the limit, the experimental changes are undone and ordinary pagination is used.
