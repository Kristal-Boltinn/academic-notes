import * as Obs from 'obsidian';
import Engine from '../indexing/engine';
import DocCore from '../export/document';
/* Read-view and Live Preview adapters. No theme-name or MathLinks dependency. */
function allNodes(el, selector) { return [...(el.matches?.(selector) ? [el] : []), ...el.querySelectorAll(selector)]; }
function titleRecord(box, r) {
    if (!r)
        return;
    const inner = box.querySelector(':scope > .callout-title > .callout-title-inner');
    if (!inner)
        return;
    box.classList.add('an-math-callout');
    box.dataset.anType = r.key;
    box.dataset.anLine = String(r.line);
    let label = inner.querySelector(':scope > .phb-type-label');
    if (!label) {
        const original = box.ownerDocument.createElement('span');
        original.className = 'phb-title-name';
        const defaultTitle = Engine.TYPES[r.key].map(x => x.toLowerCase()).includes(inner.textContent.trim().toLowerCase());
        if (!defaultTitle)
            while (inner.firstChild)
                original.appendChild(inner.firstChild);
        else
            inner.replaceChildren();
        label = box.ownerDocument.createElement('span');
        label.className = 'phb-type-label';
        inner.replaceChildren(label, original);
    }
    const text = Engine.TYPES[r.key][0] + (r.number ? ' ' + r.number : '');
    if (label.textContent !== text)
        label.textContent = text;
}
/** Captions keep Obsidian's native callout tree and block links; only decorate it. */
function mediaRecord(box, r) {
    if (!r)
        return;
    box.classList.add('an-media', 'an-' + r.kind);
    box.dataset.anLine = String(r.line);
    box.dataset.anType = r.kind;
    box.setAttribute('role', r.kind === 'table' ? 'group' : 'figure');
    const inner = box.querySelector(':scope > .callout-title > .callout-title-inner');
    if (!inner)
        return;
    let label = inner.querySelector(':scope > .an-caption-label');
    if (!label) {
        const original = box.ownerDocument.createElement('span');
        original.className = 'an-caption-text';
        const isDefault = ['', ...Engine.MEDIA[r.kind].map(x => x.toLowerCase())].includes(inner.textContent.trim().toLowerCase());
        if (!isDefault)
            while (inner.firstChild)
                original.appendChild(inner.firstChild);
        label = box.ownerDocument.createElement('span');
        label.className = 'an-caption-label';
        inner.replaceChildren(label, original);
    }
    const text = r.kind === 'subfigure' ? (r.subletter ? '(' + r.subletter + ')' : r.number || '') : Engine.MEDIA[r.kind][0] + (r.number ? ' ' + r.number : '');
    if (label.textContent !== text)
        label.textContent = text;
    if (r.kind === 'figure') {
        const content = box.querySelector(':scope > .callout-content');
        if (!content)
            return;
        const subfigs = [...content.querySelectorAll('.callout[data-callout]')].filter(n => Engine.mediaCanon(n.dataset.callout) === 'subfigure' && n.parentElement.closest('.callout') === box);
        content.classList.toggle('an-figure-grid', subfigs.length > 0);
        for (const sub of subfigs) {
            let cell = sub;
            while (cell.parentElement !== content)
                cell = cell.parentElement;
            cell.classList.add('an-subfigure-cell');
        }
        // Block declaration markers have no visible content but can occupy a grid cell.
        for (const child of content.children)
            if (child.matches('p') && !child.textContent.trim() && !child.querySelector('img,svg,math'))
                child.classList.add('an-empty-anchor');
    }
}
function mathRecord(mjx, r) {
    if (!r)
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
            mjx.setAttribute(key, rendered.getAttribute(key));
        else
            mjx.removeAttribute(key);
    }
    mjx.classList.add('an-numbered-math');
    return true;
}
function renderFragment(el, note, graph, infoFor) {
    if (!note || !graph)
        return;
    const used = new Set();
    const pick = (node, records) => {
        const info = infoFor(node) || {};
        if (!Number.isInteger(info.lineStart))
            return null;
        const candidates = records.filter(r => !used.has(r) && r.line >= info.lineStart && r.line <= info.lineEnd);
        const rec = candidates[0];
        if (rec)
            used.add(rec);
        return rec;
    };
    for (const box of allNodes(el, '.callout[data-callout]')) {
        const key = Engine.canon(box.dataset.callout);
        if (!key)
            continue;
        const r = pick(box, note.theorems.filter(r => r.key === key));
        if (r)
            titleRecord(box, r);
    }
    used.clear();
    for (const box of allNodes(el, '.callout[data-callout]')) {
        const key = Engine.mediaCanon(box.dataset.callout);
        if (!key)
            continue;
        const r = pick(box, note.media.filter(r => r.key === key));
        if (r)
            mediaRecord(box, r);
    }
    used.clear();
    let mathChanged = false;
    for (const mjx of allNodes(el, 'mjx-container[display="true"]')) {
        const r = pick(mjx, note.equations);
        if (r)
            mathChanged = mathRecord(mjx, r) || mathChanged;
    }
    if (mathChanged)
        Promise.resolve(Obs.finishRenderMath()).catch(console.error);
    const usedRefs = new Set();
    for (const a of allNodes(el, 'a.internal-link,a[data-href]')) {
        if (a.closest('svg,mjx-container,.phb-toc'))
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
        a.classList.add('an-ref');
        a.dataset.anRef = 'true';
        a.setAttribute('aria-label', `${text} — ${r.path} ^${ref.block}`);
    }
}
function createLiveExtension(plugin) {
    const { ViewPlugin, Decoration, WidgetType } = require('@codemirror/view');
    const { StateEffect } = require('@codemirror/state');
    const refresh = StateEffect.define();
    plugin.refreshEffect = refresh;
    class LinkWidget extends WidgetType {
        [key: string]: any;
        constructor(label, raw, path, offset) { super(); Object.assign(this, { label, raw, path, offset }); }
        eq(b) { return this.label === b.label && this.raw === b.raw && this.path === b.path && this.offset === b.offset; }
        toDOM(view) {
            const a = view.dom.ownerDocument.createElement('a');
            a.className = 'internal-link an-ref';
            a.textContent = this.label;
            a.dataset.href = this.raw;
            a.href = this.raw;
            a.tabIndex = 0;
            a.setAttribute('aria-label', this.label + ' — ' + this.raw);
            const open = evt => { evt.preventDefault(); evt.stopPropagation(); plugin.openReference(this.raw, this.path, !!(evt.ctrlKey || evt.metaKey)).catch(e => plugin.fail('打开块引用', e)); };
            a.addEventListener('click', open);
            a.addEventListener('keydown', e => { if (e.key === 'Enter')
                open(e); });
            a.addEventListener('dblclick', e => { e.preventDefault(); view.dispatch({ selection: { anchor: this.offset + 2 } }); view.focus(); });
            return a;
        }
        ignoreEvent() { return true; }
    }
    return ViewPlugin.fromClass(class {
        [key: string]: any;
        constructor(view) {
            this.view = view;
            this.disposed = false;
            plugin.editorViews.add(view);
            this.decorations = this.links(view);
            this.schedule();
            this.observer = new MutationObserver(() => this.schedule());
            this.observer.observe(view.contentDOM, { childList: true, subtree: true });
        }
        update(update) { if (update.docChanged || update.selectionSet || update.viewportChanged || update.transactions.some(t => t.effects.some(e => e.is(refresh))))
            this.decorations = this.links(update.view); this.schedule(); }
        links(view) {
            const live = view.state.field(Obs.editorLivePreviewField, false), info = view.state.field(Obs.editorInfoField, false);
            if (!live || !info?.file || !plugin.settings.livePreview || !plugin.graph)
                return Decoration.none;
            const source = view.state.doc.toString(), note = plugin.graph.notes.get(info.file.path);
            // Never apply positions from a stale index to an edited document.
            if (!note || note.source !== source)
                return Decoration.none;
            const ranges = [] as any[];
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
                ranges.push(Decoration.replace({ widget: new LinkWidget(text, ref.raw, note.path, ref.from) }).range(ref.from, ref.to));
            }
            return Decoration.set(ranges, true);
        }
        schedule() { if (this.timer || this.disposed)
            return; this.timer = setTimeout(() => { this.timer = null; try {
            this.paint();
        }
        catch (e) {
            plugin.recordError('Live Preview DOM', e);
        } }, 30); }
        paint() {
            const view = this.view, info = view.state.field(Obs.editorInfoField, false);
            if (this.disposed || !view.state.field(Obs.editorLivePreviewField, false) || !info?.file || !plugin.settings.livePreview)
                return;
            const note = plugin.graph?.notes.get(info.file.path);
            if (!note || note.source !== view.state.doc.toString())
                return;
            const infoFor = node => {
                let line;
                try {
                    line = view.state.doc.lineAt(view.posAtDOM(node)).number - 1;
                }
                catch {
                    return null;
                }
                const eq = note.equations.find(r => r.line <= line && r.endLine >= line);
                if (eq && !node.matches('.callout'))
                    return { lineStart: eq.line, lineEnd: eq.endLine };
                const box = note.callouts.filter(r => r.line <= line && r.endLine >= line).sort((a, b) => b.depth - a.depth)[0];
                return { lineStart: box?.line ?? line, lineEnd: box?.endLine ?? line };
            };
            renderFragment(view.contentDOM, note, plugin.graph, infoFor);
        }
        destroy() { this.disposed = true; clearTimeout(this.timer); this.observer.disconnect(); plugin.editorViews.delete(this.view); }
    }, { decorations: v => v.decorations });
}
export { titleRecord, mediaRecord, renderFragment, createLiveExtension, allNodes };
