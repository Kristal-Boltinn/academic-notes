import { titleInk } from './custom-appearance';
import { algorithmRecord } from '../algorithms/render';
import { t } from '../i18n';
import { applyFigureLayout } from './figure-layout';
import { hasParagraphSelection, layoutReadOnlyCallout, restoreParagraphs } from '../typography/dom';
import { nativeEditorInteraction, nativeCalloutBodyInteraction, editorIdleScheduler } from './editor-dom';
import { traceLayout } from '../diagnostics/layout';
import * as Obs from 'obsidian';
import Engine from '../indexing/engine';
import type AcademicNotes from '../main';
import type { ParsedNote, SourceRecord, SourceReference, NoteGraph } from '../indexing/engine';
import { ViewPlugin, Decoration, WidgetType, type EditorView, type ViewUpdate, type DecorationSet } from '@codemirror/view';
import { StateEffect, type Range } from '@codemirror/state';
type SectionInfo = { lineStart: number; lineEnd: number };
// CodeMirror owns editable DOM. Reparenting its text while a title is edited can
// trigger DOM reconciliation and repeated selection/scroll restoration.
function editableLiveNode(node: HTMLElement) {
    return nativeEditorInteraction(node);
}
function setAttribute(node: HTMLElement, name: string, value: string) { if (node.getAttribute(name) !== value) node.setAttribute(name, value); }
function setClass(node: Element, name: string, enabled = true) { if (node.classList.contains(name) !== enabled) node.classList.toggle(name, enabled); }
/* Read-view and Live Preview adapters. No theme-name or MathLinks dependency. */
function allNodes(el: HTMLElement, selector: string): HTMLElement[] { return [...(el.matches?.(selector) ? [el] : []), ...el.querySelectorAll<HTMLElement>(selector)]; }
function titleRecord(box: HTMLElement, r: SourceRecord | null | undefined, graph?: NoteGraph | null) {
    if (!r || editableLiveNode(box))
        return;
    const inner = box.querySelector(':scope > .callout-title > .callout-title-inner');
    if (!inner)
        return;
    setClass(box, 'an-math-callout');
    setAttribute(box, 'data-an-type', r.key);
    setClass(box, 'an-custom-environment', !!r.environment);
    if (r.environment) {
        setAttribute(box, 'data-an-style', r.environment.style);
        for (const mode of ['light', 'dark'] as const) {
            const color = r.environment[mode];
            for (const [part, value] of [['color', color], ['ink', color && titleInk(color)]]) {
                const property = `--an-custom-${part}-${mode}`;
                if (value) { if (box.style.getPropertyValue(property) !== value) box.style.setProperty(property, value); } else box.style.removeProperty(property);
            }
        }
    }
    setAttribute(box, 'data-an-line', String(r.line));
    setClass(box, 'an-proof-own-line', r.key === 'proof' && !!r.proofOwnLine);
    const proofLink = r.key === 'proof' ? r.title?.match(/^\[\[([^\]]+)\]\]$/) : null;
    const proofTarget = proofLink && graph?.resolve(proofLink[1].split('|')[0], r.path);
    setClass(box, 'an-proof-reference', !!proofTarget && proofTarget.kind === 'theorem');
    let label = inner.querySelector(':scope > .phb-type-label');
    if (!label) {
        const original = box.ownerDocument.win.createSpan();
        original.className = 'phb-title-name';
        const defaultTitle = Engine.typeNames(r.key, graph?.settings).map(x => x.toLowerCase()).includes(inner.textContent.trim().toLowerCase());
        if (!defaultTitle)
            while (inner.firstChild)
                original.appendChild(inner.firstChild);
        else
            inner.replaceChildren();
        label = box.ownerDocument.win.createSpan();
        label.className = 'phb-type-label';
        inner.replaceChildren(label, original);
    }
    const text = Engine.labelName(r.key, graph?.settings) + (box.classList.contains('an-proof-reference') ? ' of' : '') + (r.number ? ' ' + r.number : '');
    if (label.textContent !== text)
        label.textContent = text;
    if (proofTarget && proofTarget.kind === 'theorem' && (!graph?.settings.respectAliases || !proofLink[1].includes('|'))) {
        const link = inner.querySelector('a.internal-link,a[data-href]');
        const reference = Engine.refText(proofTarget, graph!.settings);
        if (link && link.textContent !== reference) link.textContent = reference;
    }
}
/** Captions keep Obsidian's native callout tree and block links; only decorate it. */
function mediaRecord(box: HTMLElement, r: SourceRecord | null | undefined, settings = Engine.DEFAULTS) {
    if (!r || editableLiveNode(box))
        return;
    setClass(box, 'an-media'); setClass(box, 'an-' + r.kind);
    setAttribute(box, 'data-an-line', String(r.line));
    setAttribute(box, 'data-an-type', r.kind);
    setClass(box, 'an-captionless', r.kind === 'subfigure' && !r.title?.trim() && !r.number);
    setAttribute(box, 'role', r.kind === 'table' ? 'group' : 'figure');
    const inner = box.querySelector(':scope > :is(.callout-title,.an-diagram-caption) > .callout-title-inner');
    if (!inner)
        return;
    let label = inner.querySelector(':scope > .an-caption-label');
    if (!label) {
        const original = box.ownerDocument.win.createSpan();
        original.className = 'an-caption-text';
        const isDefault = !r.title?.trim();
        if (!isDefault)
            while (inner.firstChild)
                original.appendChild(inner.firstChild);
        label = box.ownerDocument.win.createSpan();
        label.className = 'an-caption-label';
        inner.replaceChildren(label, original);
    }
    const text = r.kind === 'subfigure' ? (r.subletter ? '(' + r.subletter + ')' : r.number || '') : Engine.labelName(r.kind, settings) + (r.number ? ' ' + r.number : '');
    if (label.textContent !== text)
        label.textContent = text;
    if (r.kind === 'figure') {
        const content = box.querySelector(':scope > .callout-content');
        if (!content)
            return;
        const subfigs = [...content.querySelectorAll<HTMLElement>('.callout[data-callout]')].filter(n => Engine.mediaCanon(n.dataset.callout) === 'subfigure' && n.parentElement!.closest('.callout') === box);
        setClass(content, 'an-figure-grid', subfigs.length > 0);
        applyFigureLayout(box, subfigs.length, r.layout);
        for (const sub of subfigs) {
            let cell = sub;
            while (cell.parentElement !== content)
                cell = cell.parentElement!;
            setClass(cell, 'an-subfigure-cell');
        }
        // Block declaration markers have no visible content but can occupy a grid cell.
        for (const child of content.children)
            if (child.matches('p') && !child.textContent.trim() && !child.querySelector('img,svg,math'))
                setClass(child, 'an-empty-anchor');
    }
}
function mathRecord(mjx: HTMLElement, r: SourceRecord | null | undefined) {
    if (!r || editableLiveNode(mjx))
        return false;
    const tex = Engine.taggedTex(r), signature = JSON.stringify([tex, r.number]);
    if (mjx.dataset.anMath === signature)
        return false;
    mjx.dataset.anMath = signature;
    mjx.dataset.anLine = String(r.line);
    if (r.manual || r.multiTag)
        return false; // Native rendering owns explicit tags.
    const rendered = Obs.renderMath(tex, true);
    // Retain the host element, native events, source mapping, and its outer layout wrapper.
    mjx.replaceChildren(...rendered.childNodes);
    for (const key of ['style', 'jax', 'display', 'width']) {
        if (rendered.hasAttribute(key))
            mjx.setAttribute(key, rendered.getAttribute(key)!);
        else
            mjx.removeAttribute(key);
    }
    mjx.classList.add('an-numbered-math');
    return true;
}
function renderFragment(el: HTMLElement, note: ParsedNote | undefined, graph: NoteGraph | null, infoFor: (node: HTMLElement) => SectionInfo | null) {
    if (!note || !graph)
        return;
    const used = new Set();
    const pick = (node: HTMLElement, records: SourceRecord[]) => {
        const info = infoFor(node);
        if (!info || !Number.isInteger(info.lineStart))
            return null;
        const candidates = records.filter(r => !used.has(r) && r.line >= info.lineStart && r.line <= info.lineEnd);
        const rec = candidates[0];
        if (rec)
            used.add(rec);
        return rec;
    };
    for (const box of allNodes(el, '.callout[data-callout]')) {
        const key = Engine.canon(box.dataset.callout, graph.settings);
        if (!key)
            continue;
        const r = pick(box, note.theorems.filter(r => r.key === key));
        if (r)
            titleRecord(box, r, graph);
    }
    used.clear();
    for (const box of allNodes(el, '.callout[data-callout]')) {
        const key = Engine.mediaCanon(box.dataset.callout);
        if (!key)
            continue;
        const r = pick(box, note.media.filter(r => r.key === key && !r.diagram && r.kind !== 'algorithm'));
        if (r)
            mediaRecord(box, r, graph.settings);
    }
    used.clear();
    for (const host of allNodes(el, '.callout[data-callout="algorithm"],.an-algorithm-fence')) {
        const record = pick(host, note.media.filter(r => r.kind === 'algorithm'));
        if (record) algorithmRecord(host, record, graph.settings.algorithmLineNumbers, Engine.labelName("algorithm", graph.settings));
    }
    used.clear();
    let mathChanged = false;
    for (const diagram of allNodes(el, '.an-diagram-block')) {
        const record = pick(diagram, note.media.filter(r => r.diagram));
        const caption = diagram.querySelector<HTMLElement>('.an-diagram-caption');
        if (caption && caption.hidden !== !record) caption.hidden = !record;
        if (record) mediaRecord(diagram, record, graph.settings);
    }
    used.clear();
    for (const mjx of allNodes(el, 'mjx-container[display="true"]')) {
        const r = pick(mjx, note.equations);
        if (r)
            mathChanged = mathRecord(mjx, r) || mathChanged;
    }
    if (mathChanged)
        Promise.resolve(Obs.finishRenderMath()).catch(console.error);
    const usedRefs = new Set<SourceReference>();
    for (const a of allNodes(el, 'a.internal-link,a[data-href]')) {
        if (editableLiveNode(a) || a.closest('svg,mjx-container,.phb-toc'))
            continue;
        const raw = a.dataset.href || a.getAttribute('href') || '';
        const r = graph.resolve(raw, note.path);
        if (!r)
            continue;
        const range = infoFor(a), refs = note.refs.filter(x => !x.embed && !usedRefs.has(x) &&
            (x.raw === raw || graph.resolve(x.raw, note.path) === r) && (!range || x.line >= range.lineStart && x.line <= range.lineEnd));
        const ref = refs[0];
        if (ref)
            usedRefs.add(ref);
        // Unknown provenance or an explicit alias must not be silently overwritten.
        if (!ref)
            continue;
        if (graph.settings.respectAliases && ref.alias !== null)
            continue;
        const text = Engine.refText(r, graph.settings);
        if (a.textContent !== text)
            a.textContent = text;
        setClass(a, 'an-ref');
        setAttribute(a, 'data-an-ref', 'true');
        setAttribute(a, 'aria-label', `${text} — ${r.path} ^${ref.block}`);
    }
}
function createLiveExtension(plugin: AcademicNotes) {
    const refresh = StateEffect.define<number>();
    plugin.refreshEffect = refresh;
    class LinkWidget extends WidgetType {
        label: string; raw: string; path: string; offset: number;
        constructor(label: string, raw: string, path: string, offset: number) { super(); Object.assign(this, { label, raw, path, offset }); }
        eq(b: LinkWidget) { return this.label === b.label && this.raw === b.raw && this.path === b.path && this.offset === b.offset; }
        toDOM(view: EditorView) {
            const a = view.dom.ownerDocument.win.createEl('a');
            a.className = 'internal-link an-ref';
            a.textContent = this.label;
            a.dataset.href = this.raw;
            a.href = this.raw;
            a.tabIndex = 0;
            a.setAttribute('aria-label', this.label + ' — ' + this.raw);
            const open = (evt: MouseEvent | KeyboardEvent) => { evt.preventDefault(); evt.stopPropagation(); plugin.openReference(this.raw, this.path, !!(evt.ctrlKey || evt.metaKey)).catch(e => plugin.fail(t("打开块引用"), e)); };
            a.addEventListener('click', open);
            a.addEventListener('keydown', e => { if (e.key === 'Enter')
                open(e); });
            a.addEventListener('dblclick', e => { e.preventDefault(); view.dispatch({ selection: { anchor: this.offset + 2 } }); view.focus(); });
            return a;
        }
        ignoreEvent() { return true; }
    }
    return ViewPlugin.fromClass(class {
        view: EditorView; disposed: boolean; decorations: DecorationSet; observer: MutationObserver;
        idle: ReturnType<typeof editorIdleScheduler>;
        layouts = new WeakMap<HTMLElement, { key: string; nodes: Node[] }>();
        deferredSelection = false;
        selectionChanged = () => { if (this.deferredSelection) this.schedule(); };
        compositionEnd = () => this.schedule();
        fontsChanged = () => { this.layouts = new WeakMap(); this.schedule(); };
        constructor(view: EditorView) {
            this.view = view;
            this.disposed = false;
            plugin.editorViews.add(view);
            this.decorations = this.links(view);
            this.idle = editorIdleScheduler(view.dom, () => { try { this.paint(); } catch (e) { plugin.recordError('Live Preview DOM', e); } });
            this.schedule();
            this.observer = new MutationObserver(() => this.schedule());
            this.observer.observe(view.contentDOM, { childList: true, subtree: true });
            view.contentDOM.addEventListener('compositionend', this.compositionEnd);
            view.dom.ownerDocument.fonts?.addEventListener('loadingdone', this.fontsChanged);
            view.dom.ownerDocument.addEventListener('selectionchange', this.selectionChanged);
        }
        update(update: ViewUpdate) { if (update.docChanged || update.selectionSet || update.viewportChanged || update.geometryChanged || update.transactions.some(t => t.effects.some(e => e.is(refresh)))) {
            this.decorations = this.links(update.view); this.schedule(); } }
        links(view: EditorView) {
            const live = view.state.field(Obs.editorLivePreviewField, false), info = view.state.field(Obs.editorInfoField, false);
            if (!live || !info?.file || !plugin.settings.livePreview || !plugin.graph)
                return Decoration.none;
            const source = view.state.doc.toString(), note = plugin.graph.notes.get(info.file.path);
            // Never apply positions from a stale index to an edited document.
            if (!note || note.source !== source)
                return Decoration.none;
            const ranges: Range<Decoration>[] = [];
            for (const ref of note.refs) {
                if (ref.embed || ref.syntax !== 'wiki' || !ref.target)
                    continue;
                if (plugin.settings.respectAliases && ref.alias !== null)
                    continue;
                if (view.state.selection.ranges.some(s => s.from <= ref.to && s.to >= ref.from))
                    continue;
                if (!view.visibleRanges.some(v => ref.to >= v.from && ref.from <= v.to))
                    continue;
                const text = Engine.refText(ref.target, plugin.settings);
                ranges.push(Decoration.replace({ widget: new LinkWidget(text || '', ref.raw, note.path, ref.from) }).range(ref.from, ref.to));
            }
            return Decoration.set(ranges, true);
        }
        schedule() { this.idle.schedule(); }
        paint() {
            const view = this.view, info = view.state.field(Obs.editorInfoField, false);
            traceLayout(view.contentDOM, 'live.paint', { composing: view.composing });
            if (this.disposed || view.composing || view.compositionStarted || !view.state.field(Obs.editorLivePreviewField, false) || !info?.file)
                return;
            const note = plugin.graph?.notes.get(info.file.path);
            if (!note || note.source !== view.state.doc.toString())
                return;
            const infoFor = (node: HTMLElement) => {
                let line;
                try {
                    line = view.state.doc.lineAt(view.posAtDOM(node)).number - 1;
                }
                catch {
                    return null;
                }
                const algorithm = node.matches('.an-algorithm-fence') && note.media.find(r => r.kind === 'algorithm' && r.line <= line && r.endLine >= line);
                if (algorithm) return { lineStart: algorithm.line, lineEnd: algorithm.endLine };
                const diagram = node.matches('.an-diagram-block') && note.media.find(r => r.diagram && r.line <= line && r.endLine >= line);
                if (diagram) return { lineStart: diagram.line, lineEnd: diagram.endLine };
                const eq = note.equations.find(r => r.line <= line && r.endLine >= line);
                if (eq && !node.matches('.callout'))
                    return { lineStart: eq.line, lineEnd: eq.endLine };
                const box = note.callouts.filter(r => r.line <= line && r.endLine >= line).sort((a, b) => b.depth - a.depth)[0];
                return { lineStart: box?.line ?? line, lineEnd: box?.endLine ?? line };
            };
            this.observer.disconnect();
            try {
                if (plugin.settings.livePreview) renderFragment(view.contentDOM, note, plugin.graph, infoFor);
                let attempted = 0;
                this.deferredSelection = false;
                for (const box of view.contentDOM.querySelectorAll<HTMLElement>('.callout')) {
                    if (box.dataset.callout === 'algorithm') continue;
                    if (nativeCalloutBodyInteraction(box)) { traceLayout(box, 'live.native-skip'); this.deferredSelection = true; continue; }
                    if (!box.closest('[contenteditable="false"]')) continue;
                    if (hasParagraphSelection(box)) { this.deferredSelection = true; continue; }
                    // Body layout is confined to the host's read-only widget subtree.
                    // Never restructure native editable lines or an editable callout title.
                    if (++attempted > 40) break;
                    const section = infoFor(box); if (!section) continue;
                    const from = view.state.doc.line(Math.min(view.state.doc.lines, section.lineStart + 1)).from;
                    const to = view.state.doc.line(Math.min(view.state.doc.lines, section.lineEnd + 1)).to;
                    const enabled = plugin.settings.kpLivePreview && !view.state.selection.ranges.some(range => range.from <= to && range.to >= from);
                    const content = box.querySelector<HTMLElement>(':scope > .callout-content'); if (!content) continue;
                    const title = box.querySelector<HTMLElement>(':scope > .callout-title'), win = box.ownerDocument.defaultView!;
                    const style = win.getComputedStyle(content), titleStyle = title && win.getComputedStyle(title);
                    const key = enabled ? [note.source.slice(from, to), content.getBoundingClientRect().width, style.font, style.lineHeight, style.letterSpacing, style.wordSpacing,
                        content.textContent, ...[...content.querySelectorAll<HTMLElement>('.math,mjx-container')].map(math => math.getBoundingClientRect().width),
                        title?.textContent, title?.getBoundingClientRect().width, titleStyle?.cssFloat, titleStyle?.font].join('|') : '';
                    const previous = this.layouts.get(box);
                    if (previous?.key === key && previous.nodes.length === content.childNodes.length && previous.nodes.every((node, index) => content.childNodes[index] === node)) continue;
                    restoreParagraphs(box);
                    traceLayout(box, 'live.layout', { enabled });
                    if (enabled) layoutReadOnlyCallout(box);
                    this.layouts.set(box, { key, nodes: [...content.childNodes] });
                }
            }
            finally { if (!this.disposed) this.observer.observe(view.contentDOM, { childList: true, subtree: true }); }
        }
        destroy() {
            this.disposed = true; this.idle.dispose(); this.observer.disconnect();
            this.view.contentDOM.removeEventListener('compositionend', this.compositionEnd); this.view.dom.ownerDocument.fonts?.removeEventListener('loadingdone', this.fontsChanged);
            this.view.dom.ownerDocument.removeEventListener('selectionchange', this.selectionChanged);
            for (const box of this.view.contentDOM.querySelectorAll<HTMLElement>('.callout')) {
                if (!nativeCalloutBodyInteraction(box) && box.closest('[contenteditable="false"]')) restoreParagraphs(box);
            }
            plugin.editorViews.delete(this.view);
        }
    }, { decorations: v => v.decorations });
}
export { titleRecord, mediaRecord, renderFragment, createLiveExtension, allNodes };
