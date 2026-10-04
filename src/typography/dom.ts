import { solveParagraph, type KpItem } from './solver';
import { traceLayout } from '../diagnostics/layout';

export interface ParagraphLayoutReport { processed: number; skipped: number; fallback: number }
interface SavedParagraph { nodes: Node[]; lines: HTMLElement[]; owner?: object; marker: string | null; hadClass: boolean; hadQed: boolean; classAttribute: string | null; text: string | null }
interface Unit { node: Node; start?: number; end?: number; text: string; kind: 'word' | 'cjk' | 'punct' | 'space' | 'inline' }
interface Token { item: KpItem; unit?: Unit }
const saved = new WeakMap<HTMLElement, SavedParagraph>();
const MAX_PARAGRAPHS = 120, MAX_CHARACTERS = 4000, MAX_ITEMS = 900, MAX_TOTAL_ITEMS = 12000;
const EDITOR = '.cm-editor,.cm-content,.markdown-source-view,[contenteditable="true"],[contenteditable="plaintext-only"]';
const EXCLUDED = 'table,li,figcaption,.phb-toc,.phb-frontmatter,.an-diagram-block,.an-diagram-caption,.callout-title,.an-media';
function editableContext(root: HTMLElement, readonlyCallout?: HTMLElement) {
    if (!root.closest(EDITOR)) return root.isContentEditable;
    return !readonlyCallout || !readonlyCallout.contains(root) || !readonlyCallout.closest('[contenteditable="false"]') || readonlyCallout.isContentEditable ||
        !!readonlyCallout.querySelector('[contenteditable="true"],[contenteditable="plaintext-only"],input,textarea') || root.isContentEditable;
}
const CJK = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const OPENING = /^[([{（［｛〈《「『【〔〖〘〚‘“]$/u;
const CLOSING = /^[)\]}）］｝〉》」』】〕〗〙〛、。，．！？：；,.!?:;’”…ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]$/u;
const NONBREAKING = /[\u00a0\u202f\u2060\ufeff]/u;

function paragraphs(root: HTMLElement) { return [...(root.matches('p') ? [root] : []), ...root.querySelectorAll<HTMLElement>('p')]; }
/** Reading selections must survive indexing, resizing and font changes until the user finishes copying. */
export function hasParagraphSelection(root: HTMLElement) {
    const selection = root.ownerDocument.getSelection();
    if (!selection || selection.isCollapsed) return false;
    for (let index = 0; index < selection.rangeCount; index++) {
        try { if (selection.getRangeAt(index).intersectsNode(root)) return true; } catch { /* A detached host range is irrelevant. */ }
    }
    return false;
}
function isOwned(p: HTMLElement, state: SavedParagraph) { return p.textContent === state.text && p.childNodes.length === state.lines.length && state.lines.every((line, index) => p.childNodes[index] === line); }
function unwrapLines(p: HTMLElement) {
    const content: Node[] = [];
    for (const line of [...p.children]) for (const node of [...line.childNodes]) {
        if (node.nodeType === 1 && (node as Element).matches('span.an-kp-space')) content.push(...node.childNodes);
        else content.push(node);
    }
    p.replaceChildren(...content);
}
function restore(p: HTMLElement, owner?: object) {
    const state = saved.get(p);
    if (state) {
        if (owner && state.owner !== owner) return;
        // A host rerender may already have replaced our lines. Never overwrite its new content.
        if (isOwned(p, state)) p.replaceChildren(...state.nodes);
        else if (p.childNodes.length === state.lines.length && state.lines.every((line, index) => p.childNodes[index] === line)) unwrapLines(p);
        if (state.marker === null) p.removeAttribute('data-an-kp'); else p.setAttribute('data-an-kp', state.marker);
        if (!state.hadClass) p.classList.remove('an-kp-paragraph');
        if (!state.hadQed) p.classList.remove('an-kp-qed');
        if (state.classAttribute === null && !p.classList.length) p.removeAttribute('class');
        saved.delete(p);
    } else if (!owner && p.dataset.anKp === '1') {
        // A serialized HTML snapshot has no WeakMap. Unwrap only our exact line/gap markup.
        const lines = [...p.children];
        if (!lines.length || !lines.every(line => line.matches('span.an-kp-line'))) return;
        unwrapLines(p); p.removeAttribute('data-an-kp'); p.classList.remove('an-kp-paragraph', 'an-kp-qed'); if (!p.classList.length) p.removeAttribute('class');
    }
}
/** Removes generated presentation nodes, retaining original elements, listeners and text nodes. */
export function restoreParagraphs(root: HTMLElement) { for (const p of paragraphs(root)) restore(p); }

function proofEnd(p: HTMLElement) {
    return p.matches('.callout:is([data-callout="proof"],[data-callout="pf"]) > .callout-content > p:last-child') &&
        p.ownerDocument.defaultView!.getComputedStyle(p, '::after').content.replace(/["']/g, '') === '□';
}
function eligible(p: HTMLElement, readonlyCallout?: HTMLElement) {
    if (p.closest(EXCLUDED) || editableContext(p, readonlyCallout) || p.querySelector('[contenteditable],br,img,video,audio,iframe,button,input,textarea,select,canvas,pre,table,.math-block,mjx-container[display="true"],.phb-math[data-display="true"],.an-diagram-block')) return false;
    const win = p.ownerDocument.defaultView; if (!win) return false;
    const style = win.getComputedStyle(p);
    if (style.direction !== 'ltr' || style.writingMode !== 'horizontal-tb' || style.whiteSpace !== 'normal' || Math.abs(parseFloat(style.textIndent) || 0) > .01 || !['start', 'left', 'justify'].includes(style.textAlign)) return false;
    for (const pseudo of ['::before', '::after']) {
        const value = win.getComputedStyle(p, pseudo).content;
        if (value && !['none', 'normal', '""', "''"].includes(value) && !(pseudo === '::after' && proofEnd(p))) return false;
    }
    for (const element of p.children) {
        if (!/^(A|EM|STRONG|B|I|S|DEL|MARK|U|SUB|SUP|CODE|SMALL|SPAN|MJX-CONTAINER|SVG)$/.test(element.tagName.toUpperCase())) return false;
        const inline = win.getComputedStyle(element);
        if (inline.cssFloat !== 'none' || !['inline', 'inline-block', 'inline-flex'].includes(inline.display) || inline.position === 'absolute' || inline.position === 'fixed') return false;
    }
    return true;
}
function textUnits(node: Text): Unit[] | null {
    const Segmenter = Intl.Segmenter;
    if (!Segmenter) return null;
    const parts = [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(node.data)];
    const units: Unit[] = [];
    for (const part of parts) {
        const text = part.segment, kind = /^[\t\r\n ]+$/u.test(text) ? 'space' : CJK.test(text) ? 'cjk' : OPENING.test(text) || CLOSING.test(text) ? 'punct' : 'word';
        const previous = units.at(-1);
        if (previous && (kind === 'word' || kind === 'space') && previous.kind === kind) {
            previous.text += text; previous.end = part.index + text.length;
        } else units.push({ node, start: part.index, end: part.index + text.length, text, kind });
    }
    return units;
}
function legalBoundary(left: Unit | undefined, right: Unit | undefined) {
    if (!left || !right) return true;
    const tail = Array.from(left.text).at(-1) || '', head = Array.from(right.text)[0] || '';
    return !OPENING.test(tail) && !CLOSING.test(head) && !NONBREAKING.test(tail) && !NONBREAKING.test(head);
}
function contentWidth(p: HTMLElement) {
    const style = p.ownerDocument.defaultView!.getComputedStyle(p);
    return p.getBoundingClientRect().width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0) - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0);
}
function availableWidths(p: HTMLElement, width: number): number | number[] | null {
    const content = p.parentElement;
    if (!content?.matches('.callout-content')) return width;
    const title = content.parentElement?.querySelector<HTMLElement>(':scope > .callout-title');
    if (!title) return width;
    const win = p.ownerDocument.defaultView!, style = win.getComputedStyle(title);
    if (style.cssFloat === 'none') return width;
    const box = p.getBoundingClientRect(), label = title.getBoundingClientRect();
    if (label.bottom <= box.top + .5 || label.top >= box.bottom) return width;
    const lineHeight = parseFloat(win.getComputedStyle(p).lineHeight);
    // A tall/overhanging float needs more than a single reduced line; keep it native.
    if (style.cssFloat !== 'left' || !Number.isFinite(lineHeight) || label.top > box.top + 1 || label.bottom > box.top + lineHeight + 1) return null;
    const first = width - Math.max(0, label.right - box.left + (parseFloat(style.marginRight) || 0));
    return first > 40 ? [first, width] : null;
}
function endReserve(p: HTMLElement) {
    if (!proofEnd(p)) return 0;
    const probe = makeSpan(p.ownerDocument, 'an-kp-qed-probe'); probe.textContent = '□'; p.appendChild(probe);
    try { return probe.getBoundingClientRect().width + (parseFloat(p.ownerDocument.defaultView!.getComputedStyle(probe).marginInlineStart) || 0); }
    finally { probe.remove(); }
}
function measure(p: HTMLElement, units: Unit[]): Token[] | null {
    const style = p.ownerDocument.defaultView!.getComputedStyle(p), em = parseFloat(style.fontSize) || 16;
    const before = p.getAttribute('class');
    const range = p.ownerDocument.createRange(), tokens: Token[] = [];
    p.classList.add('an-kp-measure');
    try {
        if (p.ownerDocument.defaultView!.getComputedStyle(p).whiteSpace !== 'nowrap') return null;
        for (let index = 0; index < units.length; index++) {
            const unit = units[index], previous = units[index - 1], next = units[index + 1];
            if (previous && previous.kind !== 'space' && unit.kind !== 'space' && (previous.kind === 'cjk' || unit.kind === 'cjk') && legalBoundary(previous, unit)) tokens.push({ item: { type: 'glue', width: 0, stretch: em * .12, shrink: 0 } });
            if (unit.start !== undefined) { range.setStart(unit.node, unit.start); range.setEnd(unit.node, unit.end!); }
            else range.selectNode(unit.node);
            let width = range.getBoundingClientRect().width;
            if (unit.kind === 'inline') {
                const inline = p.ownerDocument.defaultView!.getComputedStyle(unit.node as Element);
                // The inline element's own box excludes offscreen assistive math
                // descendants that may be included in a Range's union on WebKit.
                width = (unit.node as HTMLElement).getBoundingClientRect().width + (parseFloat(inline.marginLeft) || 0) + (parseFloat(inline.marginRight) || 0);
            }
            if (!Number.isFinite(width) || width < 0) return null;
            const item: KpItem = unit.kind === 'space' && legalBoundary(previous, next) ? { type: 'glue', width, stretch: Math.max(width * .65, em * .12), shrink: width * .4 } : { type: 'box', width };
            tokens.push({ item, unit });
            if (tokens.length > MAX_ITEMS) return null;
        }
        return tokens;
    } finally {
        if (before === null) p.removeAttribute('class'); else p.setAttribute('class', before);
    }
}
function makeSpan(doc: Document, cls: string) {
    // This renderer also runs in an isolated print window without Obsidian DOM helpers.
    const span = doc.createElement('span'); span.className = cls; return span;
}
/** Range metrics can differ from the final shaped line on WebKit/custom fonts.
 * Keep the solver's breaks, then distribute the measured residual over its glue.
 * Never adjust glyphs, formulas, titles or the natural final line. */
function alignRenderedLine(line: HTMLElement, gaps: { node: HTMLElement; stretch: number }[]) {
    const last = [...line.childNodes].reverse().find(node => node.nodeType === 3 && !!node.textContent?.trim() || node.nodeType === 1 && !(node as Element).matches('.an-kp-space'));
    if (!last) return false;
    const range = line.ownerDocument.createRange(); range.selectNode(last);
    for (let pass = 0; pass < 3; pass++) {
        const box = line.getBoundingClientRect();
        const right = last.nodeType === 1 ? (last as Element).getBoundingClientRect().right : range.getBoundingClientRect().right;
        const residual = box.right - right;
        if (Math.abs(residual) <= .5) return true;
        // A large discrepancy indicates an unsupported layout, not rounding.
        if (!Number.isFinite(residual) || Math.abs(residual) > box.width * .15) return false;
        const eligible = gaps.filter(gap => residual > 0 ? gap.stretch > 0 : parseFloat(gap.node.style.width) > 0);
        const weight = eligible.reduce((sum, gap) => sum + (residual > 0 ? gap.stretch : parseFloat(gap.node.style.width)), 0);
        if (!weight || residual < -weight) return false;
        for (const gap of eligible) {
            const width = parseFloat(gap.node.style.width), share = residual > 0 ? gap.stretch : width;
            gap.node.style.width = Math.max(0, width + residual * share / weight) + 'px';
        }
    }
    const right = last.nodeType === 1 ? (last as Element).getBoundingClientRect().right : range.getBoundingClientRect().right;
    return Math.abs(line.getBoundingClientRect().right - right) < 2;
}
function apply(p: HTMLElement, tokens: Token[], width: number, owner?: object) {
    const widths = availableWidths(p, width), reserve = endReserve(p);
    if (widths === null) return 'fallback';
    const items = tokens.map(token => token.item);
    const solution = solveParagraph(items, widths, reserve) ||
        (reserve > 0 || Array.isArray(widths) || tokens.some(token => token.unit?.kind === 'inline') ? solveParagraph(items, widths, reserve, (parseFloat(p.ownerDocument.defaultView!.getComputedStyle(p).fontSize) || 16) * 2) : null);
    if (!solution) return 'fallback';
    if (solution.lines.length < 2) return 'skip';
    const original = [...p.childNodes], text = p.textContent;
    const state: SavedParagraph = { nodes: original, lines: [], owner, marker: p.getAttribute('data-an-kp'), hadClass: p.classList.contains('an-kp-paragraph'), hadQed: p.classList.contains('an-kp-qed'), classAttribute: p.getAttribute('class'), text };
    let cursor = 0;
    const lineGaps: { node: HTMLElement; stretch: number }[][] = [];
    for (let index = 0; index < solution.lines.length; index++) {
        const line = solution.lines[index], end = solution.lines[index + 1]?.from ?? tokens.length;
        const node = makeSpan(p.ownerDocument, 'an-kp-line');
        const gaps: { node: HTMLElement; stretch: number }[] = [];
        if (index === 0 && Array.isArray(widths)) node.style.width = widths[0] + 'px';
        let lastBox = line.to - 1;
        while (lastBox >= line.from && tokens[lastBox].item.type !== 'box') lastBox--;
        for (; cursor < end; cursor++) {
            const token = tokens[cursor], unit = token.unit;
            if (token.item.type === 'glue' || unit?.kind === 'space') {
                const gap = makeSpan(p.ownerDocument, 'an-kp-space');
                if (unit) gap.appendChild(p.ownerDocument.createTextNode(unit.text));
                const visible = cursor >= line.from && cursor <= lastBox;
                const item = token.item;
                const value = !visible ? 0 : item.type === 'glue' ? item.width + line.ratio * (line.ratio < 0 ? item.shrink : item.stretch) : item.width;
                gap.style.width = Math.max(0, value) + 'px';
                if (visible && item.type === 'glue') gaps.push({ node: gap, stretch: item.stretch });
                node.appendChild(gap);
            } else if (unit) node.appendChild(unit.start === undefined ? unit.node : p.ownerDocument.createTextNode(unit.text));
        }
        state.lines.push(node);
        lineGaps.push(gaps);
    }
    p.replaceChildren(...state.lines); p.dataset.anKp = '1'; p.classList.add('an-kp-paragraph'); saved.set(p, state);
    if (reserve) p.classList.add('an-kp-qed');
    if (p.textContent !== text || state.lines.slice(0, -1).some((line, index) => !alignRenderedLine(line, lineGaps[index])) ||
        state.lines.some(line => line.scrollWidth > line.getBoundingClientRect().width + 2)) { restore(p, owner); return 'fallback'; }
    return 'processed';
}
function layout(root: HTMLElement, owner?: object, readonlyCallout?: HTMLElement): ParagraphLayoutReport {
    const report = { processed: 0, skipped: 0, fallback: 0 };
    if (root.closest(EXCLUDED) || editableContext(root, readonlyCallout) || hasParagraphSelection(root)) return { processed: 0, skipped: paragraphs(root).length, fallback: 0 };
    let total = 0, attempted = 0;
    for (const p of paragraphs(root)) {
        const existing = saved.get(p);
        if (owner && existing?.owner && existing.owner !== owner) { report.skipped++; continue; }
        restore(p, owner);
        const text = p.textContent || '';
        if (!eligible(p, readonlyCallout) || !text.trim() || text.length > MAX_CHARACTERS || attempted >= MAX_PARAGRAPHS || total >= MAX_TOTAL_ITEMS) { report.skipped++; continue; }
        const width = contentWidth(p); if (!Number.isFinite(width) || width < 80) { report.skipped++; continue; }
        const units: Unit[] = [];
        let unsupported = false;
        for (const node of p.childNodes) {
            if (node.nodeType === 3) { const parts = textUnits(node as Text); if (!parts) { unsupported = true; break; } units.push(...parts); }
            else if (node.nodeType === 1) units.push({ node, text: node.textContent || '', kind: 'inline' });
            else { unsupported = true; break; }
        }
        if (unsupported || units.length > MAX_ITEMS) { report.skipped++; continue; }
        const estimated = units.length + units.filter((unit, index) => index > 0 && units[index - 1].kind !== 'space' && unit.kind !== 'space' && (units[index - 1].kind === 'cjk' || unit.kind === 'cjk') && legalBoundary(units[index - 1], unit)).length;
        if (total + estimated > MAX_TOTAL_ITEMS) { report.skipped++; continue; }
        total += estimated;
        attempted++;
        const tokens = measure(p, units);
        if (!tokens) { report.fallback++; continue; }
        const result = apply(p, tokens, width, owner);
        if (result === 'processed') report.processed++; else if (result === 'fallback') report.fallback++; else report.skipped++;
    }
    traceLayout(root, 'kp.layout', report);
    return report;
}
/** One bounded pass for reading view or a fully loaded static export document. */
export function layoutParagraphs(root: HTMLElement) { return layout(root); }
/** Only non-editable host callout widgets may use the DOM renderer inside Live Preview. */
export function layoutReadOnlyCallout(root: HTMLElement) {
    return root.matches('.callout') ? layout(root, undefined, root) : { processed: 0, skipped: 0, fallback: 0 };
}

export interface ParagraphLayoutController { refresh(): void; dispose(): void }
/** Reading view only. Reflow runs after quiet changes; observers never react to our own edits. */
export function createParagraphLayoutController(root: HTMLElement, options: { enabled?: boolean | (() => boolean); onError?: (error: unknown) => void } = {}): ParagraphLayoutController {
    const owner = {}, doc = root.ownerDocument, win = doc.defaultView;
    if (!win || root.closest(EXCLUDED) || editableContext(root)) return { refresh() {}, dispose() {} };
    let disposed = false, deferredSelection = false, timer: number | undefined, lastWidth = root.getBoundingClientRect().width;
    const enabled = () => typeof options.enabled === 'function' ? options.enabled() : options.enabled !== false;
    const observe = () => changes.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'contenteditable', 'hidden', 'src', 'width', 'height'] });
    const run = () => {
        timer = undefined; if (disposed || editableContext(root)) return;
        if (hasParagraphSelection(root)) { deferredSelection = true; return; }
        deferredSelection = false;
        changes.disconnect();
        try {
            if (enabled()) layout(root, owner); else for (const p of paragraphs(root)) restore(p, owner);
            lastWidth = root.getBoundingClientRect().width;
        } catch (error) { for (const p of paragraphs(root)) restore(p, owner); options.onError?.(error); }
        finally { if (!disposed) observe(); }
    };
    const refresh = () => { if (!disposed && timer === undefined) timer = win.setTimeout(run, 70); };
    const changes = new MutationObserver(refresh);
    const resize = new ResizeObserver(() => { const width = root.getBoundingClientRect().width; if (Math.abs(width - lastWidth) > .5) refresh(); });
    const theme = new MutationObserver(refresh);
    const css = new MutationObserver(refresh);
    const resource = (event: Event) => { const target = event.target as Element | null; if (target && (target.tagName === 'LINK' || root.contains(target))) refresh(); };
    const selection = () => { if (deferredSelection && !hasParagraphSelection(root)) refresh(); };
    observe(); resize.observe(root); theme.observe(doc.body, { attributes: true, attributeFilter: ['class', 'style'] });
    css.observe(doc.head, { childList: true, characterData: true, subtree: true });
    doc.fonts.addEventListener('loadingdone', refresh); doc.addEventListener('load', resource, true); doc.addEventListener('selectionchange', selection);
    void doc.fonts.ready.then(refresh); refresh();
    return { refresh, dispose() { if (disposed) return; disposed = true; win.clearTimeout(timer); changes.disconnect(); resize.disconnect(); theme.disconnect(); css.disconnect(); doc.fonts.removeEventListener('loadingdone', refresh); doc.removeEventListener('load', resource, true); doc.removeEventListener('selectionchange', selection); if (!editableContext(root)) for (const p of paragraphs(root)) restore(p, owner); } };
}
