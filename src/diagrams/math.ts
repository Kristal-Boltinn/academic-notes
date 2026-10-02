export function mathSource(label: string) {
    const text = label.trim();
    if (text.startsWith('$$') && text.endsWith('$$')) return text.slice(2, -2).trim();
    if (text.startsWith('$') && text.endsWith('$')) return text.slice(1, -1).trim();
    if ((text.startsWith('\\(') && text.endsWith('\\)')) || (text.startsWith('\\[') && text.endsWith('\\]'))) return text.slice(2, -2).trim();
    return text;
}

/** Initialize the private renderer only when a diagram needs the fallback. */
export async function localMathSvg(doc: Document, source: string) {
    const { localMathSvg: render } = await import('./svg-math');
    return render(doc, source);
}
