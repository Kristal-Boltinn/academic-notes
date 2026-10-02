import { renderMath, finishRenderMath } from 'obsidian';
import type { DiagramData } from './model';
import { localMathSvg, mathSource } from './math';
import { commutationArc, diagramPosition } from './geometry';
let sequence = 0;
const NS = 'http://www.w3.org/2000/svg';
/** SVG geometry and native MathJax labels; no innerHTML from user data. */
export async function renderDiagram(container: HTMLElement, data: DiagramData, selectArrow?: (id: string) => void, selectedArrow = '', selectCommutation?: (id: string) => void, selectedCommutation = '') {
    data = { ...data, nodes: data.nodes.map(n => ({ ...n })), arrows: data.arrows.map(a => ({ ...a })), commutations: data.commutations?.map(c => ({ ...c })) };
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
    const stage = doc.win.createDiv({ cls: 'an-diagram-math-stage' });
    const formulas = new Map<string, HTMLElement>();
    for (const text of [...data.nodes.map(n => n.label), ...data.arrows.map(a => a.label)]) {
        if (!text || formulas.has(text)) continue;
        const holder = stage.createSpan();
        try { holder.appendChild(renderMath(mathSource(text), false)); } catch { /* Use the local SVG fallback below. */ }
        formulas.set(text, holder);
    }
    container.replaceChildren(svg, stage);
    let nativeFinished = true;
    try { await finishRenderMath(); } catch { nativeFinished = false; }
    // A later edit can replace this preview while MathJax is finishing.
    if (svg.parentElement !== container) { stage.remove(); return svg; }
    try {
        for (const [text, holder] of formulas) {
            const local = !nativeFinished || !holder.querySelector('svg');
            if (local) holder.replaceChildren(await localMathSvg(doc, mathSource(text)));
            const picture = holder.querySelector('svg');
            if (!picture) throw new Error('Unable to render diagram formula as SVG.');
            picture.setAttribute('data-an-renderer', local ? 'local' : 'native');
            picture.setAttribute('aria-label', mathSource(text));
        }
    } catch (error) { stage.remove(); throw error; }
    const sizes = new Map<string, { width: number; height: number }>();
    for (const [text, holder] of formulas) {
        const picture = holder.querySelector('svg'), rect = picture?.getBoundingClientRect();
        const width = rect?.width || text.length * 11, height = rect?.height || 24;
        const scale = Math.min(1, 190 / width, 56 / height);
        sizes.set(text, { width: width * scale, height: height * scale });
    }
    let labelSerial = 0;
    const label = (text: string, x: number, y: number, parent: SVGElement = svg) => {
        if (!text) return;
        const size = sizes.get(text)!, picture = formulas.get(text)!.querySelector('svg')!;
        // Keep formulas and arrows in one SVG coordinate system. foreignObject
        // HTML has inconsistent scaling/positioning in mobile WebKit hosts.
        element('rect', { x: x - size.width / 2 - 3, y: y - size.height / 2 - 2, width: size.width + 6, height: size.height + 4, fill: 'var(--background-primary,white)' }, parent);
        {
            const clone = picture.cloneNode(true) as SVGSVGElement;
            clone.classList.add('an-diagram-math'); clone.setAttribute('x', String(x - size.width / 2)); clone.setAttribute('y', String(y - size.height / 2));
            clone.setAttribute('width', String(size.width)); clone.setAttribute('height', String(size.height));
            clone.style.setProperty('width', size.width + 'px'); clone.style.setProperty('height', size.height + 'px');
            clone.style.removeProperty('vertical-align'); parent.appendChild(clone);
            const ids = new Map<string,string>(), prefix = markerId + '-math-' + ++labelSerial + '-';
            clone.querySelectorAll('[id]').forEach(node => { const old = node.id; ids.set(old, prefix + old); node.id = prefix + old; });
            clone.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attr => {
                if (['href','xlink:href'].includes(attr.name) && attr.value.startsWith('#') && ids.has(attr.value.slice(1))) node.setAttribute(attr.name, '#' + ids.get(attr.value.slice(1)));
                else if (attr.value.includes('url(#')) node.setAttribute(attr.name, attr.value.replace(/url\(#([^)]*)\)/g, (all, key: string) => ids.has(key) ? `url(#${ids.get(key)})` : all));
            }));
        }
    };
    const position = (id: string) => diagramPosition(data, id);
    for (const arrow of data.arrows) {
        const a = position(arrow.from), b = position(arrow.to), dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
        const inset = (id: string) => { const size = sizes.get(data.nodes.find(n => n.id === id)!.label) || { width: 20, height: 20 }; return Math.min(ux ? (size.width / 2 + 12) / Math.abs(ux) : Infinity, uy ? (size.height / 2 + 12) / Math.abs(uy) : Infinity); };
        const from = inset(arrow.from), to = inset(arrow.to), shift = arrow.side === 'above' ? -24 : 24;
        const path = `M ${a.x + ux * from} ${a.y + uy * from} L ${b.x - ux * to} ${b.y - uy * to}`;
        const group = element('g', { 'data-an-arrow': arrow.id });
        if (selectArrow) {
            group.setAttribute('tabindex', '0'); group.setAttribute('role', 'button'); group.setAttribute('aria-label', arrow.from + ' → ' + arrow.to);
            group.classList.add('an-diagram-interactive-arrow'); group.classList.toggle('is-selected', arrow.id === selectedArrow);
            group.addEventListener('click', () => selectArrow(arrow.id));
            group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectArrow(arrow.id); } });
            element('path', { d: path, fill: 'none', stroke: 'transparent', 'stroke-width': 24, 'pointer-events': 'stroke' }, group);
        }
        element('path', { d: path, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'marker-end': `url(#${markerId})`, ...(arrow.style === 'dashed' ? { 'stroke-dasharray': '6 5' } : {}) }, group);
        label(arrow.label, (a.x + b.x) / 2 + (Math.abs(dy) > Math.abs(dx) ? shift * 1.5 : 0), (a.y + b.y) / 2 + (Math.abs(dx) >= Math.abs(dy) ? shift : 0), group);
    }
    for (const item of data.commutations || []) {
        const { path } = commutationArc(data, item), group = element('g', { 'data-an-commutation': item.id });
        const name = (id: string) => data.nodes.find(n => n.id === id)!.label;
        group.setAttribute('aria-label', `${name(item.from)} → ${name(item.via)} → ${name(item.to)} = ${name(item.from)} → ${name(item.to)}`);
        if (selectCommutation) {
            group.setAttribute('tabindex', '0'); group.setAttribute('role', 'button');
            group.classList.add('an-diagram-interactive-arrow'); group.classList.toggle('is-selected', item.id === selectedCommutation);
            group.addEventListener('click', () => selectCommutation(item.id));
            group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCommutation(item.id); } });
            element('path', { d: path, fill: 'none', stroke: 'transparent', 'stroke-width': 24, 'pointer-events': 'stroke' }, group);
        }
        element('path', { d: path, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'marker-end': `url(#${markerId})` }, group);
    }
    for (const node of data.nodes) { const p = position(node.id); label(node.label, p.x, p.y); }
    stage.remove(); return svg;
}
