import type { ParsedNote } from '../indexing/engine';
import { editorFragment, nativeCalloutBodyInteraction } from '../rendering/editor-dom';

type SectionInfo = { lineStart: number; lineEnd: number };
const quote = (line: string) => {
    const prefix = line.match(/^(?: {0,3}> ?)+/)?.[0] || '';
    return { depth: prefix.match(/>/g)?.length || 0, body: line.slice(prefix.length) };
};
/** A display equation is not a paragraph separator. An empty source line is. */
export function mathContinuationLines(note: Pick<ParsedNote, 'lines' | 'equations'>) {
    const result = new Set<number>();
    for (const equation of note.equations) for (let line = equation.endLine + 1; line < note.lines.length; line++) {
        const value = quote(note.lines[line]);
        if (value.depth !== equation.depth || !value.body.trim()) break;
        if (/^\s*\^[\w-]+\s*$/.test(value.body)) continue; // Metadata does not begin prose.
        result.add(line); break;
    }
    return result;
}
/** Mark only source-proven continuations; never infer paragraph boundaries from pixels. */
export function markMathContinuations(root: HTMLElement, note: ParsedNote, infoFor?: (node: HTMLElement) => SectionInfo | null) {
    if (note.equations.length > 1200) return;
    const starts = mathContinuationLines(note), marked = new Set<HTMLElement>();
    const paragraphs = [...(root.matches('p') ? [root] : []), ...root.querySelectorAll<HTMLElement>('p')];
    if (paragraphs.length > 1200) return;
    const safe = (p: HTMLElement) => !p.closest('table,li,pre,.callout-title,.an-media,.an-algorithm') && !p.isContentEditable &&
        (!editorFragment(p) || !!p.closest('[contenteditable="false"]') && !nativeCalloutBodyInteraction(p));
    // Separate reading sections can map a paragraph directly to its source start.
    if (infoFor) for (const p of paragraphs) {
        const info = infoFor(p); if (safe(p) && info && starts.has(info.lineStart)) marked.add(p);
    }
    const blocks = [...new Set([...root.querySelectorAll<HTMLElement>('.math-block,mjx-container[display="true"]')].map(node => node.closest<HTMLElement>('.math-block') || node))];
    // A complete rendered chapter, or a complete mapped callout section, can
    // pair native equation blocks in source order. Ambiguous partial roots skip.
    const groups = new Map<string, { info: SectionInfo; blocks: HTMLElement[] }>();
    for (const block of blocks) {
        const info = infoFor ? infoFor(block) : { lineStart: 0, lineEnd: note.lines.length - 1 };
        if (!info || !Number.isInteger(info.lineStart) || !Number.isInteger(info.lineEnd)) continue;
        const key = `${info.lineStart}:${info.lineEnd}`, group = groups.get(key) || { info, blocks: [] };
        group.blocks.push(block); groups.set(key, group);
    }
    for (const { info, blocks } of groups.values()) {
        const equations = note.equations.filter(eq => eq.line >= info.lineStart && eq.endLine <= info.lineEnd);
        if (equations.length !== blocks.length) continue;
        for (let index = 0; index < blocks.length; index++) {
            const equation = equations[index];
            let line = equation.endLine + 1;
            while (line < note.lines.length && /^\s*\^[\w-]+\s*$/.test(quote(note.lines[line]).body)) line++;
            if (!starts.has(line)) continue;
            const block = blocks[index];
            const outer = block.parentElement?.matches('p') ? block.parentElement : block;
            let next = outer.nextElementSibling;
            while (next?.matches('.phb-anchor') || next?.matches('p') && !next.textContent?.trim() && !next.querySelector('img,mjx-container')) next = next.nextElementSibling;
            if (next?.matches('p') && safe(next as HTMLElement)) marked.add(next as HTMLElement);
        }
    }
    for (const p of paragraphs) if (safe(p) && p.classList.contains('an-prose-continuation') !== marked.has(p)) p.classList.toggle('an-prose-continuation', marked.has(p));
}
