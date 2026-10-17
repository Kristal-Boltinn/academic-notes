# Basic numbering

[toc]

## Compactness

> [!def] Compact set
> A topological space is compact if every open cover admits a finite subcover.

^def-compact

> [!thm] A finite example
> Every finite topological space is compact.

^thm-finite

By [[#^def-compact]], [[#^thm-finite]] follows by choosing one open set per point.

> [!proof]
> There are only finitely many points.

$$
\sum_{k=1}^{n} 1 = n
$$

^eq-count

The elementary identity [[#^eq-count]] is referenced and therefore numbered.

## LaTeX labels

Display equations can carry LaTeX labels. A label works like a block ID and can be referenced across files:

$$
a^2 + b^2 = c^2 \label{eq-pythagoras}
$$

The same number can be referenced with `\eqref` or `\ref` in another display block:

$$
\eqref{eq-pythagoras} \quad \ref{eq-pythagoras}
$$

`\eqref` is clickable in Reading view and Live Preview. The reference suggestion also inserts
`\eqref{...}` instead of a wiki link when the cursor is inside `$$`.

## Multi-line rows

Put the label on the row that should be numbered. Other rows stay unnumbered, and each
labeled row gets its own counter value:

$$
\begin{align*}
a &= b \\
c &= d \label{eq:c} \\
e &= f \label{eq:e}
\end{align*}
$$

$$
\eqref{eq:c} \quad \eqref{eq:e}
$$

`aligned`, `gathered`, `split`, `align`, `gather`, `multline` and `eqnarray` are upgraded to
their starred display form when a row carries a label. A manual `\tag` still wins.

###### 1.2.3 This is an ordinary six-level heading
