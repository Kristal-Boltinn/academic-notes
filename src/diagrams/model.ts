export interface DiagramNode { id: string; row: number; col: number; label: string }
export interface DiagramArrow { id: string; from: string; to: string; label: string; style: 'solid' | 'dashed'; side: 'above' | 'below' }
export interface DiagramCommutation { id: string; from: string; via: string; to: string }
export interface DiagramData { version: 1; grid: 2 | 3; nodes: DiagramNode[]; arrows: DiagramArrow[]; caption?: string; commutations?: DiagramCommutation[] }
export const emptyDiagram = (): DiagramData => ({ version: 1, grid: 2, nodes: [], arrows: [] });
const label = (value: unknown): string => {
    if (typeof value !== 'string' || value.length > 200 || /[\r\n]/.test(value)) throw new Error('Invalid diagram label (maximum 200 characters, one line).');
    return value;
};
const id = (value: unknown): string => {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,40}$/.test(value)) throw new Error('Invalid diagram identifier.');
    return value;
};
/** Versioned data only; labels are never interpreted as HTML or executable code. */
export function parseDiagram(source: string): DiagramData {
    if (source.length > 20000) throw new Error('Diagram data is too large.');
    const value = JSON.parse(source) as Partial<DiagramData>;
    if (!value || value.version !== 1 || ![2, 3].includes(value.grid!) || !Array.isArray(value.nodes) || value.nodes.length > 9 || !Array.isArray(value.arrows) || value.arrows.length > 36) throw new Error('Invalid diagram: expected version 1, a 2×2 or 3×3 grid, at most 9 nodes and 36 arrows.');
    const nodes = value.nodes.map(n => {
        if (!n || !Number.isInteger(n.row) || !Number.isInteger(n.col) || n.row < 0 || n.col < 0 || n.row >= value.grid! || n.col >= value.grid!) throw new Error('Node is outside the diagram grid.');
        return { id: id(n.id), row: n.row, col: n.col, label: label(n.label) };
    });
    if (new Set(nodes.map(n => n.id)).size !== nodes.length || new Set(nodes.map(n => `${n.row},${n.col}`)).size !== nodes.length) throw new Error('Duplicate diagram node.');
    const ids = new Set(nodes.map(n => n.id));
    const arrows = value.arrows.map(a => {
        if (!a || !ids.has(a.from) || !ids.has(a.to) || a.from === a.to || !['solid', 'dashed'].includes(a.style) || !['above', 'below'].includes(a.side)) throw new Error('Invalid diagram arrow.');
        return { id: id(a.id), from: a.from, to: a.to, label: label(a.label), style: a.style, side: a.side };
    });
    if (new Set(arrows.map(a => a.id)).size !== arrows.length) throw new Error('Duplicate diagram arrow.');
    const data: DiagramData = { version: 1, grid: value.grid as 2 | 3, nodes, arrows, ...(value.caption === undefined ? {} : { caption: label(value.caption) }) };
    if (value.commutations !== undefined) {
        if (!Array.isArray(value.commutations) || value.commutations.length > 12) throw new Error('Invalid commutativity markers (maximum 12).');
        data.commutations = value.commutations.map(c => {
            if (!c || !isCommutingTriangle(data, c.from, c.via, c.to)) throw new Error('A commutativity marker requires three non-collinear nodes and arrows from → via → to and from → to.');
            return { id: id(c.id), from: c.from, via: c.via, to: c.to };
        });
        if (new Set(data.commutations.map(c => c.id)).size !== data.commutations.length || new Set(data.commutations.map(c => `${c.from},${c.via},${c.to}`)).size !== data.commutations.length) throw new Error('Duplicate commutativity marker.');
    }
    return data;
}
export function isCommutingTriangle(data: DiagramData, from: string, via: string, to: string) {
    const a = data.nodes.find(n => n.id === from), b = data.nodes.find(n => n.id === via), c = data.nodes.find(n => n.id === to);
    return !!(a && b && c && (b.col - a.col) * (c.row - a.row) !== (b.row - a.row) * (c.col - a.col)
        && [[from, via], [via, to], [from, to]].every(([start, end]) => data.arrows.some(e => e.from === start && e.to === end)));
}
function pruneCommutations(data: DiagramData) {
    if (data.commutations) data.commutations = data.commutations.filter(c => isCommutingTriangle(data, c.from, c.via, c.to));
}
export function removeArrow(data: DiagramData, arrowId: string) {
    data.arrows = data.arrows.filter(a => a.id !== arrowId); pruneCommutations(data);
}
export function diagramFence(data: DiagramData, prefix = '') {
    const valid = parseDiagram(JSON.stringify(data));
    return ['```academic-diagram', JSON.stringify(valid, null, 2), '```'].join('\n').split('\n').map(line => prefix + line).join('\n');
}
export function resizeDiagram(data: DiagramData, grid: 2 | 3) {
    data.grid = grid; data.nodes = data.nodes.filter(n => n.row < grid && n.col < grid);
    const ids = new Set(data.nodes.map(n => n.id)); data.arrows = data.arrows.filter(a => ids.has(a.from) && ids.has(a.to));
    pruneCommutations(data);
}
export function removeNode(data: DiagramData, nodeId: string) {
    data.nodes = data.nodes.filter(n => n.id !== nodeId); data.arrows = data.arrows.filter(a => a.from !== nodeId && a.to !== nodeId);
    pruneCommutations(data);
}
export interface DiagramBlock { from: number; to: number; line: number; prefix: string; source: string }
export function diagramBlocks(source: string): DiagramBlock[] {
    const blocks: DiagramBlock[] = []; let start = 0, fence: { marker: string; from: number; body: number; line: number; prefix: string; diagram: boolean } | null = null;
    for (const [line, raw] of source.split('\n').entries()) {
        const prefix = raw.match(/^[ \t]*(?:>[ \t]*)*/)?.[0] || '', bare = raw.slice(prefix.length).trimEnd();
        const marker = bare.match(/^(`{3,}|~{3,})(.*)$/);
        if (!fence && marker) fence = { marker: marker[1], from: start, body: start + raw.length + 1, line, prefix, diagram: marker[2].trim() === 'academic-diagram' };
        else if (fence && marker && marker[1][0] === fence.marker[0] && marker[1].length >= fence.marker.length && !marker[2].trim()) {
            if (fence.diagram) blocks.push({ from: fence.from, to: start + raw.length, line: fence.line, prefix: fence.prefix, source: source.slice(fence.body, start).split('\n').map(l => l.startsWith(fence!.prefix) ? l.slice(fence!.prefix.length) : l).join('\n').trim() });
            fence = null;
        }
        start += raw.length + 1;
    }
    return blocks;
}
