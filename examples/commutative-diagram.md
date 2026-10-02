---
title: Tensor product universal property
tags: [academic-notes, example]
---

# Tensor product universal property

Open the command palette and run **Academic Notes: Insert or edit commutative diagram (Beta)** while the cursor is in the code block, or use the rendered diagram's edit button.

The short curved arrow marks the equality of the direct map and the two-step composite. To add one in the editor, choose **Mark commutativity**, then select the source, intermediate node and target. All three directed arrows must already exist.

This example uses an enclosing figure. A standalone `academic-diagram` block also receives a Figure number from the same counter. The optional JSON `caption` field supplies its caption; the editor adds a unique `^fig-diagram-N` anchor for new diagrams. Existing anchors below a block can be retained. Tap a preview arrow to select it, use Delete selected arrow to remove it, or use Delete diagram below the rendered figure to remove the whole code block without opening source mode.

> [!figure] Factorization of a bilinear map
> ```academic-diagram
> {
>   "version": 1,
>   "grid": 2,
>   "nodes": [
>     { "id": "n-0-0", "row": 0, "col": 0, "label": "M \\times N" },
>     { "id": "n-0-1", "row": 0, "col": 1, "label": "M \\otimes_R N" },
>     { "id": "n-1-1", "row": 1, "col": 1, "label": "P" }
>   ],
>   "arrows": [
>     { "id": "a-1", "from": "n-0-0", "to": "n-0-1", "label": "\\tau", "style": "solid", "side": "above" },
>     { "id": "a-2", "from": "n-0-0", "to": "n-1-1", "label": "b", "style": "solid", "side": "below" },
>     { "id": "a-3", "from": "n-0-1", "to": "n-1-1", "label": "\\exists! \\widetilde{b}", "style": "dashed", "side": "below" }
>   ],
>   "commutations": [
>     { "id": "c-1", "from": "n-0-0", "via": "n-0-1", "to": "n-1-1" }
>   ]
> }
> ```

^fig-tensor

For an $R$-bilinear map $b:M\times N\to P$, the universal property gives a unique $R$-linear map $\widetilde b:M\otimes_R N\to P$. See [[#^fig-tensor]].
