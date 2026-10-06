---
title: Algorithm examples
tags: [academic-notes]
---

## Euclid

> [!algorithm] Euclid
> \INPUT $a,b\in\mathbb{N}$
> \WHILE{$b\ne 0$}
>   \STATE $(a,b)\gets(b,a\bmod b)$
> \ENDWHILE
> \RETURN $a$

^alg-euclid

参见 [[#^alg-euclid]]。

## Code-block variant

```algorithm
\begin{algorithm}
\caption{Euclid}
\begin{algorithmic}
\INPUT $a,b\in\mathbb{N}$
\WHILE{$b\ne 0$}
  \STATE $(a,b)\gets(b,a\bmod b)$
\ENDWHILE
\RETURN $a$
\end{algorithmic}
\end{algorithm}
```

^alg-code

See [[#^alg-code]].
