import type { EditorState } from '@codemirror/state';

/** Presentation-only source-line classification; source text is never rewritten. */
export function proseLines(state: EditorState) {
    const lines: { from: number; start: boolean }[] = [];
    if (state.doc.length > 300000) return lines;
    let frontmatter = state.doc.line(1).text.trim() === '---', fence = '', math = false, previousDepth = -1, previousProse = false, algorithmDepth = 0, list = false, htmlEnd: RegExp | null = null;
    for (let n = 1; n <= state.doc.lines; n++) {
        const line = state.doc.line(n), quote = line.text.match(/^(?: {0,3}> ?)+/), depth = quote?.[0].match(/>/g)?.length || 0;
        const text = line.text.slice(quote?.[0].length || 0);
        if (algorithmDepth && (depth < algorithmDepth || depth === algorithmDepth && /^\[![\w-]+/.test(text))) algorithmDepth = 0;
        if (/^\[!algorithm(?:\||\])/i.test(text) && depth) algorithmDepth = depth;
        if (algorithmDepth) { previousProse = false; previousDepth = depth; continue; }
        if (!text.trim() || depth !== previousDepth) list = false;
        if (/^\s*(?:[-+*]\s|\d+[.)]\s)/.test(text)) list = true;
        if (frontmatter) { if (n > 1 && /^(---|\.\.\.)\s*$/.test(text)) frontmatter = false; continue; }
        if (htmlEnd) { if (htmlEnd.test(text)) htmlEnd = null; previousProse = false; continue; }
        const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(text);
        if (marker) { if (!fence) fence = marker[1]; else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = ''; previousProse = false; continue; }
        if (fence) continue;
        if (/^\s*\$\$/.test(text)) { if (!/^\s*\$\$.+\$\$\s*$/.test(text)) math = !math; previousProse = !math; previousDepth = depth; continue; }
        if (math) continue;
        if (/^\s*<!--/.test(text)) { if (!text.includes('-->')) htmlEnd = /-->/; previousProse = false; continue; }
        const html = /^\s*<(script|style|pre|textarea|div|table|section|details)\b/i.exec(text);
        if (html) { const end = new RegExp(`</${html[1]}\\s*>`, 'i'); if (!end.test(text)) htmlEnd = end; previousProse = false; continue; }
        if (/^\^[\w-]+\s*$/.test(text) && previousDepth === depth) continue;
        if (list || !text.trim() || /^\s|^(?:#{1,6}\s|\[!|\^[\w-]+\s*$|[-+*]\s|\d+[.)]\s|[-=_*]{3,}\s*$|!\[)/.test(text) || /\|/.test(text.replace(/\[\[[^\]]+\]\]/g, ''))) { previousProse = false; previousDepth = depth; continue; }
        if (n < state.doc.lines && /^\s*(?:=+|-+)\s*$/.test(state.doc.line(n + 1).text)) { previousProse = false; continue; }
        lines.push({ from: line.from, start: !previousProse || depth !== previousDepth });
        previousProse = true; previousDepth = depth;
    }
    return lines;
}
