/** Opt-in local geometry/event recording. No source text, paths, IDs or HTML. */
type TraceCode = 'reading.editor-skip' | 'reading.render' | 'live.paint' | 'live.native-skip' | 'live.layout' | 'kp.layout';
const active = new WeakMap<Document, LayoutRecorder>();
export function traceLayout(root: HTMLElement, code: TraceCode, values: Record<string, number | boolean> = {}) { active.get(root.ownerDocument)?.trace(root, code, values); }
const round = (n: number) => Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
function role(node: Node | null): string {
    const el = node?.nodeType === 1 ? node as Element : node?.parentElement;
    if (!el) return 'none';
    const selectors = ['input', 'textarea', '.callout-title', '.callout-content', '.callout', '.cm-content', '.cm-scroller', '.cm-editor', '.markdown-preview-view', '.markdown-source-view', 'p'];
    const closest = el.closest(selectors.join(','));
    for (const selector of selectors) if (closest?.matches(selector)) return selector;
    return 'other';
}
function css(el: HTMLElement) {
    const s = el.ownerDocument.defaultView!.getComputedStyle(el);
    return { display: s.display, position: s.position, float: s.cssFloat, font: s.font, lineHeight: s.lineHeight,
        textAlign: s.textAlign, whiteSpace: s.whiteSpace, textIndent: s.textIndent, letterSpacing: s.letterSpacing, wordSpacing: s.wordSpacing,
        fontKerning: s.fontKerning, fontVariantLigatures: s.fontVariantLigatures, textSizeAdjust: s.getPropertyValue('-webkit-text-size-adjust'), direction: s.direction, writingMode: s.writingMode,
        overflowX: s.overflowX, overflowY: s.overflowY, touchAction: s.touchAction, pointerEvents: s.pointerEvents, userSelect: s.userSelect,
        webkitUserSelect: s.getPropertyValue('-webkit-user-select'), contain: s.contain, overscrollBehavior: s.overscrollBehavior };
}
function geometry(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    return { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height), scrollTop: round(el.scrollTop), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
}
function visible(el: HTMLElement) { const r = el.getBoundingClientRect(), win = el.ownerDocument.defaultView!; return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.top <= win.innerHeight && r.right >= 0 && r.left <= win.innerWidth; }
function relative(r: DOMRect, p: DOMRect) { return { left: round(r.left - p.left), right: round(r.right - p.left), top: round(r.top - p.top), height: round(r.height) }; }
function paragraph(p: HTMLElement) {
    const box = p.getBoundingClientRect(), range = p.ownerDocument.createRange(), rows = [...p.querySelectorAll<HTMLElement>(':scope > .an-kp-line')];
    const nativeRects: ReturnType<typeof relative>[] = []; let visited = 0;
    const walk = (node: Node) => {
        if (nativeRects.length >= 100 || ++visited > 300) return;
        if (node.nodeType === 3) { range.selectNodeContents(node); for (const r of range.getClientRects()) if (r.width > 0 && nativeRects.length < 100) nativeRects.push(relative(r, box)); }
        else if (node.nodeType === 1) { const el = node as HTMLElement; if (el.matches('.math,mjx-container,svg')) nativeRects.push(relative(el.getBoundingClientRect(), box)); else for (const child of el.childNodes) { if (visited > 300) break; walk(child); } }
    };
    if (!rows.length) walk(p);
    return { geometry: geometry(p), css: css(p), optimized: p.dataset.anKp === '1', optimizedLineCount: rows.length,
        characters: p.textContent?.length || 0, explicitBreaks: p.querySelectorAll('br').length, contentEditable: p.isContentEditable,
        editableDescendants: !!p.querySelector('[contenteditable="true"],[contenteditable="plaintext-only"]'),
        inlineMath: [...p.querySelectorAll<HTMLElement>('.math,mjx-container')].slice(0, 8).map(el => { const s = css(el); return { ...relative(el.getBoundingClientRect(), box), css: { font: s.font, display: s.display, position: s.position } }; }),
        rows: rows.slice(0, 50).map((line, index) => {
            const rect = line.getBoundingClientRect(); let last: Node | undefined;
            for (const child of [...line.childNodes].reverse()) if (child.nodeType === 3 && child.textContent?.trim() || child.nodeType === 1 && !(child as Element).matches('.an-kp-space')) { last = child; break; }
            let right: number | undefined;
            if (last) { range.selectNode(last); right = last.nodeType === 1 ? (last as Element).getBoundingClientRect().right : range.getBoundingClientRect().right; }
            const s = css(line);
            return { ...relative(rect, box), final: index === rows.length - 1, width: round(rect.width), rightGap: right === undefined ? null : round(rect.right - right), css: { whiteSpace: s.whiteSpace, letterSpacing: s.letterSpacing, wordSpacing: s.wordSpacing } };
        }), nativeRects };
}
export interface LayoutMetadata { pluginVersion: string; appVersion: string; ios: boolean; android: boolean; kpReading: boolean; kpLivePreview: boolean; livePreview: boolean }
export type LayoutReport = ReturnType<LayoutRecorder['report']>;
export class LayoutRecorder {
    running = true;
    private started = Date.now(); private stopped?: number;
    private ids = new WeakMap<Element, number>(); private nextId = 1;
    private events: { ms: number; code: string; node: number; role: string; values: Record<string, number | boolean>; repeat: number }[] = [];
    private counts: Record<string, number> = {}; private droppedEvents = 0; private droppedSamples = 0;
    private samples: ReturnType<LayoutRecorder['snapshot']>[] = [];
    private cleanups: (() => void)[] = []; private observed?: HTMLElement; private observer: MutationObserver;
    private tick: number; private deadline: number; private checkpoint: number;
    constructor(readonly doc: Document, readonly root: () => HTMLElement | null, readonly metadata: () => LayoutMetadata,
        readonly options: { durationMs?: number; sampleMs?: number; checkpointMs?: number; onCheckpoint?: (report: LayoutReport) => void; onFinish?: (report: LayoutReport) => void } = {}) {
        active.get(doc)?.stop(); active.set(doc, this);
        const win = doc.defaultView!;
        this.observer = new MutationObserver(records => {
            let child = 0, attribute = 0, text = 0; for (const r of records) { if (r.type === 'childList') child++; else if (r.type === 'attributes') attribute++; else text++; }
            this.event('dom.mutations', this.observed || null, { child, attribute, text });
        });
        const listen = (target: EventTarget, type: string, callback: EventListener) => { target.addEventListener(type, callback, { passive: true, capture: true }); this.cleanups.push(() => target.removeEventListener(type, callback, true)); };
        const times = new Map<string, number>();
        for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointerup', 'pointercancel', 'scroll', 'beforeinput', 'input', 'compositionstart', 'compositionend', 'focusin', 'focusout']) listen(doc, type, event => {
            const root = this.root(), target = event.target as Node | null; if (!root || !target) return;
            const inRoot = root.contains(target);
            if (!inRoot && !/^(touch|pointer)/.test(type)) return;
            const now = Date.now(); if ((type === 'touchmove' || type === 'scroll') && now - (times.get(type) || 0) < 200) return; times.set(type, now);
            const touch = event as TouchEvent, pointer = event as PointerEvent;
            this.event(type + '.capture', target, { inRoot, prevented: event.defaultPrevented, cancelable: event.cancelable, touches: touch.touches?.length ?? 0, touchPointer: pointer.pointerType === 'touch' });
            queueMicrotask(() => { if (this.running) { this.event(type + '.final', target, { prevented: event.defaultPrevented }); if (event.defaultPrevented) this.event(type + '.prevented', target); } });
        });
        listen(doc, 'selectionchange', () => { const root = this.root(), s = doc.getSelection(); if (root && s && (s.anchorNode && root.contains(s.anchorNode) || s.focusNode && root.contains(s.focusNode))) this.event('selectionchange', s.anchorNode, { collapsed: s.isCollapsed, anchorOffset: s.anchorOffset, focusOffset: s.focusOffset }); });
        listen(win, 'error', () => this.event('runtime.error', null)); listen(win, 'unhandledrejection', () => this.event('runtime.rejection', null));
        listen(win, 'resize', () => { this.event('viewport.resize', null); this.sample(); });
        if (win.visualViewport) listen(win.visualViewport, 'resize', () => { this.event('viewport.visual-resize', null); this.sample(); });
        this.sample(); this.tick = win.setInterval(() => this.sample(), options.sampleMs ?? 2000);
        this.checkpoint = win.setInterval(() => options.onCheckpoint?.(this.report()), options.checkpointMs ?? 15000);
        this.deadline = win.setTimeout(() => { const report = this.stop(); options.onFinish?.(report); }, options.durationMs ?? 90000);
    }
    private id(node: Node | null) { const el = node?.nodeType === 1 ? node as Element : node?.parentElement; if (!el) return 0; if (!this.ids.has(el)) this.ids.set(el, this.nextId++); return this.ids.get(el)!; }
    private event(code: string, node: Node | null, values: Record<string, number | boolean> = {}) {
        if (!this.running) return; this.counts[code] = (this.counts[code] || 0) + 1;
        const ms = Date.now() - this.started, id = this.id(node), previous = this.events.at(-1);
        if (previous && previous.code === code && previous.node === id && JSON.stringify(previous.values) === JSON.stringify(values) && ms - previous.ms < 250) { previous.repeat++; return; }
        this.events.push({ ms, code, node: id, role: role(node), values, repeat: 1 }); if (this.events.length > 400) { this.events.shift(); this.droppedEvents++; }
    }
    trace(node: HTMLElement, code: TraceCode, values: Record<string, number | boolean>) { const root = this.root(); if (root?.contains(node)) this.event(code, node, values); }
    private snapshot() {
        const root = this.root(), win = this.doc.defaultView!, selection = this.doc.getSelection(), vv = win.visualViewport;
        const source = root && [...root.querySelectorAll<HTMLElement>('.markdown-source-view')].find(visible);
        const reading = root && [...root.querySelectorAll<HTMLElement>('.markdown-preview-view')].some(visible);
        const mode = source ? source.classList.contains('is-live-preview') ? 'live-preview' : 'source' : reading ? 'reading' : 'unknown';
        const scrollers: { id: number; role: string; geometry: ReturnType<typeof geometry>; css: ReturnType<typeof css> }[] = [];
        if (root) { const nodes = [root, ...root.querySelectorAll<HTMLElement>('.cm-scroller,.cm-content,.markdown-preview-view,.markdown-source-view')]; for (let parent = root.parentElement, n = 0; parent && n < 5; parent = parent.parentElement, n++) nodes.push(parent); for (const node of nodes.slice(0, 18)) scrollers.push({ id: this.id(node), role: role(node), geometry: geometry(node), css: css(node) }); }
        const callouts = root ? [...root.querySelectorAll<HTMLElement>('.callout')].filter(visible).slice(0, 4).map(box => {
            const title = box.querySelector<HTMLElement>(':scope > .callout-title');
            return { id: this.id(box), proof: box.matches('[data-callout="proof"],[data-callout="pf"]'), geometry: geometry(box), css: css(box), title: title ? { geometry: geometry(title), css: css(title), contentEditable: title.isContentEditable, editableDescendants: !!title.querySelector('[contenteditable="true"],[contenteditable="plaintext-only"]') } : null,
                paragraphs: [...box.querySelectorAll<HTMLElement>(':scope > .callout-content > p')].filter(visible).slice(0, 2).map(p => ({ id: this.id(p), ...paragraph(p) })) };
        }) : [];
        const scroller = source?.querySelector<HTMLElement>('.cm-scroller');
        const hitTargets: { x: number | null; y: number | null; inRoot: boolean; role: string; editable: boolean }[] = [];
        if (scroller) {
            const rect = scroller.getBoundingClientRect();
            for (const fraction of [.2, .5, .8]) {
                const x = rect.left + rect.width / 2, y = rect.top + rect.height * fraction;
                if (x < 0 || x >= win.innerWidth || y < 0 || y >= win.innerHeight) continue;
                const hit = this.doc.elementFromPoint(x, y) as HTMLElement | null;
                hitTargets.push({ x: round(x), y: round(y), inRoot: !!hit && !!root?.contains(hit), role: role(hit), editable: !!hit?.isContentEditable });
            }
        }
        return { ms: (this.stopped || Date.now()) - this.started, mode, settings: this.metadata(), rootPresent: !!root, hitTargets,
            window: { width: win.innerWidth, height: win.innerHeight, dpr: win.devicePixelRatio, visual: vv ? { width: round(vv.width), height: round(vv.height), offsetTop: round(vv.offsetTop), scale: round(vv.scale) } : null },
            activeElement: { role: role(this.doc.activeElement), inRoot: !!root?.contains(this.doc.activeElement) },
            selection: { collapsed: selection?.isCollapsed ?? true, anchorRole: role(selection?.anchorNode || null), focusRole: role(selection?.focusNode || null), inRoot: !!root && !!(selection?.anchorNode && root.contains(selection.anchorNode) || selection?.focusNode && root.contains(selection.focusNode)) }, scrollers, callouts };
    }
    sample() {
        if (!this.running) return; const root = this.root();
        if (root !== this.observed) { this.observer.disconnect(); this.observed = root || undefined; if (root) this.observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'contenteditable'] }); }
        this.samples.push(this.snapshot()); if (this.samples.length > 24) { this.samples.splice(1, 1); this.droppedSamples++; }
    }
    report() {
        const navigator = this.doc.defaultView!.navigator;
        return JSON.parse(JSON.stringify({ schema: 'academic-notes-layout-diagnostics-v1', startedAt: new Date(this.started).toISOString(), durationMs: (this.stopped || Date.now()) - this.started, running: this.running, metadata: this.metadata(), device: { language: navigator.language, touchPoints: navigator.maxTouchPoints },
            privacy: { noteText: false, formulaSource: false, fileNames: false, sourceHtml: false, remoteUpload: false }, counts: this.counts, droppedEvents: this.droppedEvents, droppedSamples: this.droppedSamples, events: this.events, samples: this.samples })) as {
                schema: string; startedAt: string; durationMs: number; running: boolean; metadata: LayoutMetadata; device: { language: string; touchPoints: number }; privacy: Record<string, boolean>; counts: Record<string, number>; droppedEvents: number; droppedSamples: number; events: typeof this.events; samples: typeof this.samples;
            };
    }
    stop() {
        if (this.running) { this.sample(); this.stopped = Date.now(); this.running = false; const win = this.doc.defaultView!; win.clearInterval(this.tick); win.clearInterval(this.checkpoint); win.clearTimeout(this.deadline); this.observer.disconnect(); for (const cleanup of this.cleanups) cleanup(); this.cleanups = []; if (active.get(this.doc) === this) active.delete(this.doc); }
        return this.report();
    }
}
