import { renderMath, finishRenderMath } from 'obsidian';
import type { DiagramData } from './model';
let sequence = 0;
const NS = 'http://www.w3.org/2000/svg';
/** SVG geometry and native MathJax labels; no innerHTML from user data. */
export async function renderDiagram(container: HTMLElement, data: DiagramData) {
    const doc = container.ownerDocument, svg = doc.createElementNS(NS, 'svg');
    const width = 220 + (data.grid - 1) * 240, height = 170 + (data.grid - 1) * 160;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', data.nodes.map(n => n.label).join(', ')); svg.classList.add('an-diagram-svg');
    const element = (tag: string, attributes: Record<string, string | number>, parent: SVGElement = svg) => {
        const node = doc.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value)); parent.appendChild(node); return node;
    };
    const markerId = 'an-diagram-arrow-' + ++sequence;
    const defs = element('defs', {}), marker = element('marker', { id: markerId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    element('path', { d: 'M 1 1 L 9 5 L 1 9', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4 }, marker);
    const label = (text: string, x: number, y: number, nodeLabel: boolean) => {
        if (!text) return;
        const foreign = element('foreignObject', { x: x - 100, y: y - 32, width: 200, height: 64 });
        const body = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        body.className = 'an-diagram-label' + (nodeLabel ? ' an-diagram-node-label' : ''); foreign.appendChild(body);
        const tex = text.replace(/^\$(.*)\$$/, '$1');
        try { const math = renderMath(tex, false); body.appendChild(math); } catch { body.textContent = text; }
    };
    const position = (id: string) => { const n = data.nodes.find(n => n.id === id)!; return { x: 110 + n.col * 240, y: 85 + n.row * 160 }; };
    for (const arrow of data.arrows) {
        const a = position(arrow.from), b = position(arrow.to), dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
        const inset = Math.min(ux ? 96 / Math.abs(ux) : Infinity, uy ? 36 / Math.abs(uy) : Infinity), shift = arrow.side === 'above' ? -24 : 24;
        element('path', { d: `M ${a.x + ux * inset} ${a.y + uy * inset} L ${b.x - ux * inset} ${b.y - uy * inset}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'marker-end': `url(#${markerId})`, ...(arrow.style === 'dashed' ? { 'stroke-dasharray': '6 5' } : {}) });
        label(arrow.label, (a.x + b.x) / 2 + (Math.abs(dy) > Math.abs(dx) ? shift * 1.5 : 0), (a.y + b.y) / 2 + (Math.abs(dx) >= Math.abs(dy) ? shift : 0), false);
    }
    for (const node of data.nodes) { const p = position(node.id); label(node.label, p.x, p.y, true); }
    container.replaceChildren(svg); await finishRenderMath(); return svg;
}
