import Lexer from 'pseudocode/src/Lexer';
import Parser from 'pseudocode/src/Parser';

export interface AlgorithmNode {
    type: string;
    value?: string | { type?: string; name?: string; numElif?: number; hasElse?: boolean };
    whitespace?: boolean;
    children?: AlgorithmNode[] | null;
}
export interface AlgorithmData {
    tree: AlgorithmNode; caption: AlgorithmNode[]; title: string; lineNumbers?: boolean;
}
export interface AlgorithmBlock {
    from: number; to: number; line: number; endLine: number; depth: number;
    source: string; title?: string; metadata?: string; callout: boolean; ids: string[];
}
export function algorithmText(nodes: AlgorithmNode[]): string {
    return nodes.map(node => {
        const value = typeof node.value === 'string' ? node.value : '';
        const text = /^(?:font-|sizing-)/.test(node.type) ? '' : node.type === 'call' ? value + '(' + algorithmText(node.children || []) + ')' :
            node.children ? algorithmText(node.children) : node.type === 'special' ? value === '\\\\' ? ' ' : value.slice(1) : node.type === 'text-symbol' ? '\\' : value;
        return (node.whitespace ? ' ' : '') + text;
    }).join('').trim();
}
/** Reuse the upstream grammar; never evaluate TeX or accept HTML as markup. */
export function parseAlgorithm(source: string, title?: string): AlgorithmData {
    if ((title?.length || 0) > 2000) throw new Error('Algorithm caption exceeds 2,000 characters.');
    if (source.length > 30000) throw new Error('Algorithm source exceeds 30,000 characters.');
    let nesting = 0;
    for (const token of (source + (title || '')).matchAll(/(?<!\\)[{}]|\\(?:if|for|forall|while|repeat|upon|function|procedure|endif|endfor|endwhile|until|endupon|endfunction|endprocedure)\b/gi)) {
        const closing = token[0] === '}' || /^\\(?:end|until)/i.test(token[0]);
        nesting = Math.max(0, nesting + (closing ? -1 : 1));
        if (nesting > 80) throw new Error('Algorithm nesting exceeds 80 levels.');
    }
    let lineNumbers: boolean | undefined;
    source = source.trim().replace(/\\begin\{algorithmic\}\[([01])\]/g, (_all, n: string) => { lineNumbers = n === '1'; return '\\begin{algorithmic}'; });
    if (!/^\\begin\{(?:algorithm|algorithmic)\}/.test(source)) source = '\\begin{algorithmic}\n' + source + '\n\\end{algorithmic}';
    const root = new Parser(new Lexer(source)).parse();
    const children = root.children || [];
    if (children.length !== 1) throw new Error('Use one algorithm per block.');
    const tree = children[0];
    const captions = (tree.children || []).filter(node => node.type === 'caption');
    const bodies = tree.type === 'algorithm' ? (tree.children || []).filter(node => node.type === 'algorithmic') : [tree];
    if (bodies.length !== 1 || captions.length > 1) throw new Error('Use one algorithmic environment and at most one caption.');
    let caption = captions[0]?.children?.[0]?.children || [];
    if (title?.trim()) {
        const titled = new Parser(new Lexer('\\begin{algorithm}\\caption{' + title.trim() + '}\\begin{algorithmic}\\end{algorithmic}\\end{algorithm}')).parse();
        caption = titled.children?.[0]?.children?.[0]?.children?.[0]?.children || [];
    }
    return { tree: bodies[0], caption, title: algorithmText(caption), lineNumbers };
}
/** Scan original Markdown, respecting quote depth and enclosing code fences. */
export function algorithmBlocks(source: string): AlgorithmBlock[] {
    const lines = source.split('\n'), starts: number[] = [];
    let offset = 0; lines.forEach(line => { starts.push(offset); offset += line.length + 1; });
    const visible = source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/, text => text.replace(/[^\r\n]/g, ' '))
        .replace(/<!--[\s\S]*?(?:-->|$)|%%[\s\S]*?(?:%%|$)/g, text => text.replace(/[^\r\n]/g, ' ')).split('\n');
    const quote = (line: string) => { const match = line.match(/^(?:[ \t]*>[ \t]?)+/); return { depth: match?.[0].match(/>/g)?.length || 0, body: line.slice(match?.[0].length || 0) }; };
    const strip = (line: string, depth: number) => { for (let n = 0; n < depth; n++) line = line.replace(/^[ \t]*>[ \t]?/, ''); return line; };
    const result: AlgorithmBlock[] = [];
    let fence: { marker: string; depth: number } | undefined;
    for (let line = 0; line < lines.length; line++) {
        const q = quote(visible[line]), marker = q.body.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence) { if (marker && q.depth === fence.depth && marker[1][0] === fence.marker[0] && marker[1].length >= fence.marker.length && !marker[2].trim()) fence = undefined; continue; }
        const callout = q.depth && q.body.match(/^\[!algorithm(?:\|([^\]]*))?\][+-]?[ \t]*(.*?)\r?$/i);
        if (!callout && !marker) continue;
        if (marker && !/^algorithm\s*$/i.test(marker[2].trim())) { fence = { marker: marker[1], depth: q.depth }; continue; }
        if (!q.depth && /^(?: {4}|\t)/.test(lines[line])) continue;
        let endLine = line;
        if (callout) {
            while (endLine + 1 < lines.length) {
                const next = quote(lines[endLine + 1]);
                if (next.depth < q.depth || next.depth === q.depth && /^\[![\w-]+/.test(next.body)) break;
                endLine++;
            }
        } else {
            for (let n = line + 1; n < lines.length; n++) {
                const next = quote(lines[n]), close = next.body.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
                if (next.depth < q.depth) break;
                if (close && next.depth === q.depth && close[1][0] === marker![1][0] && close[1].length >= marker![1].length) { endLine = n; break; }
            }
            if (endLine === line) { fence = { marker: marker![1], depth: q.depth }; continue; }
        }
        const ids: string[] = [];
        const body = lines.slice(line + 1, callout ? endLine + 1 : endLine).map(text => strip(text, q.depth)).filter(text => {
            const id = text.match(/^\s*\^([A-Za-z0-9-]+)\s*$/); if (callout && id) { ids.push(id[1]); return false; } return true;
        }).join('\n');
        result.push({ from: starts[line], to: starts[endLine] + lines[endLine].length, line, endLine, depth: q.depth, source: body,
            title: callout ? callout[2] : undefined, metadata: callout ? callout[1] : undefined, callout: !!callout, ids });
        line = endLine;
    }
    return result;
}
