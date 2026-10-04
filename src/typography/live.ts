import { StateEffect, StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import type AcademicNotes from '../main';
import { solveParagraph, type KpItem } from './solver';
import { editorIdleScheduler } from '../rendering/editor-dom';
import { proseLines } from './prose';

interface Plan { from: number; to: number; decorations: Range<Decoration>[] }
interface Token { from: number; to: number; item: KpItem }
const measured = StateEffect.define<Plan[]>();
const composing = StateEffect.define<boolean>();
const cjk = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const opening = /[([{（［｛〈《「『【‘“]$/u;
const closing = /^[)\]}）］｝〉》」』】、。，！？：；,.!?:;’”]/u;

class Gap extends WidgetType {
    constructor(readonly width: number) { super(); }
    eq(other: Gap) { return this.width === other.width; }
    toDOM(view: EditorView) { const el = view.dom.ownerDocument.win.createSpan({ cls: 'an-kp-live-gap' }); el.style.width = this.width + 'px'; return el; }
}
class Break extends WidgetType {
    eq() { return true; }
    get lineBreaks() { return 1; }
    toDOM(view: EditorView) { return view.dom.ownerDocument.win.createEl('br', { cls: 'an-kp-live-break' }); }
}

/** The first editable beta deliberately supports only complete, single-source-line plain paragraphs. */
function candidates(state: EditorState) {
    const result: { from: number; to: number; text: string }[] = [];
    if (state.doc.length > 300000) return result;
    let fence = '', htmlEnd: RegExp | null = null, frontmatter = state.doc.line(1).text.trim() === '---';
    for (let n = 1; n <= state.doc.lines; n++) {
        const line = state.doc.line(n), text = line.text;
        if (frontmatter) { if (n > 1 && /^(---|\.\.\.)\s*$/.test(text)) frontmatter = false; continue; }
        if (htmlEnd) { if (htmlEnd.test(text)) htmlEnd = null; continue; }
        if (!fence && /^\s*<!--/.test(text)) { if (!text.includes('-->')) htmlEnd = /-->/; continue; }
        const html = !fence && /^\s*<(script|style|pre|textarea|div|table|section|details)\b/i.exec(text);
        if (html) { const end = new RegExp(`</${html[1]}\\s*>`, 'i'); if (!end.test(text)) htmlEnd = end; continue; }
        const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(text);
        if (marker) { if (!fence) fence = marker[1]; else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = ''; continue; }
        if (fence || text.length < 80 || text.length > 3000 || /^\s/.test(text) || /[#>*_`[\]$\\|<>&\u00a0\u202f\u2060\ufeff\t\p{Script=Arabic}\p{Script=Hebrew}\u202a-\u202e\u2066-\u2069]/u.test(text) || /^(?:[-+]\s|\d+[.)]\s|[-=]{3,}\s*$)/.test(text) || /\s{2}$/.test(text)) continue;
        // Blank boundaries exclude multiline prose, list continuations, setext headings and callouts.
        if (n > 1 && state.doc.line(n - 1).text.trim() || n < state.doc.lines && state.doc.line(n + 1).text.trim()) continue;
        result.push({ from: line.from, to: line.to, text });
    }
    return result;
}
function active(state: EditorState, plan: { from: number; to: number }) {
    return state.selection.ranges.some(range => range.from <= plan.to && range.to >= plan.from);
}
function planParagraph(text: string, offset: number, width: number, context: CanvasRenderingContext2D, em: number, indent: number): Plan | null {
    if (!Intl.Segmenter) return null;
    const parts: { text: string; from: number; to: number; kind: string }[] = [];
    for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
        const kind = part.segment === ' ' ? 'space' : cjk.test(part.segment) ? 'cjk' : 'word';
        const previous = parts.at(-1);
        if (previous?.kind === kind && kind !== 'cjk' && !opening.test(part.segment) && !closing.test(part.segment)) { previous.text += part.segment; previous.to = part.index + part.segment.length; }
        else parts.push({ text: part.segment, from: part.index, to: part.index + part.segment.length, kind });
    }
    const tokens: Token[] = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i], previous = parts[i - 1], next = parts[i + 1];
        if (previous && previous.kind !== 'space' && part.kind !== 'space' && (previous.kind === 'cjk' || part.kind === 'cjk') && !opening.test(previous.text) && !closing.test(part.text))
            tokens.push({ from: part.from, to: part.from, item: { type: 'glue', width: 0, stretch: em * .12, shrink: 0 } });
        const natural = context.measureText(part.text).width;
        tokens.push({ from: part.from, to: part.to, item: part.kind === 'space' && !opening.test(previous?.text || '') && !closing.test(next?.text || '') ? { type: 'glue', width: natural, stretch: Math.max(natural * .65, em * .12), shrink: natural * .4 } : { type: 'box', width: natural } });
    }
    if (tokens.length > 900) return null;
    const solution = solveParagraph(tokens.map(token => token.item), [width - indent - 1, width - 1]);
    if (!solution || solution.lines.length < 2) return null;
    const decorations: Range<Decoration>[] = [];
    let cursor = 0;
    for (let i = 0; i < solution.lines.length; i++) {
        const line = solution.lines[i], end = solution.lines[i + 1]?.from ?? tokens.length;
        const startPos = tokens[cursor].from, endPos = tokens[end - 1].to;
        if (endPos > startPos) decorations.push(Decoration.mark({ class: 'an-kp-live-line' }).range(offset + startPos, offset + endPos));
        let last = line.to - 1; while (last >= line.from && tokens[last].item.type !== 'box') last--;
        for (; cursor < end; cursor++) {
            const token = tokens[cursor], item = token.item;
            if (item.type !== 'glue') continue;
            const gap = cursor < line.from || cursor > last ? 0 : Math.max(0, item.width + line.ratio * (line.ratio < 0 ? item.shrink : item.stretch));
            if (token.from === token.to) { if (gap) decorations.push(Decoration.widget({ widget: new Gap(gap), side: -1 }).range(offset + token.from)); }
            else decorations.push(Decoration.mark({ class: 'an-kp-live-gap', attributes: { style: `width:${gap}px` } }).range(offset + token.from, offset + token.to));
        }
        if (i < solution.lines.length - 1) decorations.push(Decoration.widget({ widget: new Break(), side: -1 }).range(offset + endPos));
    }
    return { from: offset, to: offset + text.length, decorations };
}

/** All editable nodes remain owned by CodeMirror; layout never changes document text. */
export function createLiveParagraphExtension(plugin: AcademicNotes) {
    const enabled = (state: EditorState) => plugin.settings.kpLivePreview && !!state.field(editorLivePreviewField, false);
    const field = StateField.define<{ plans: Plan[]; composing: boolean; decorations: DecorationSet; prose: ReturnType<typeof proseLines> }>({
        create: state => ({ plans: [], composing: false, decorations: Decoration.none, prose: proseLines(state) }),
        update(value, tr) {
            let plans = tr.docChanged ? [] : value.plans, isComposing = value.composing;
            const prose = tr.docChanged ? proseLines(tr.state) : value.prose;
            for (const effect of tr.effects) { if (effect.is(measured)) plans = effect.value; if (effect.is(composing)) isComposing = effect.value; }
            const ranges = enabled(tr.state) && !isComposing ? plans.filter(plan => !active(tr.state, plan)).flatMap(plan => plan.decorations) : [];
            if ((enabled(tr.state) || plugin.settings.paragraphIndent) && tr.state.field(editorLivePreviewField, false))
                for (const line of prose) ranges.push(Decoration.line({ class: 'an-prose-line' + (line.start ? ' an-prose-start' : '') }).range(line.from));
            return { plans, composing: isComposing, decorations: Decoration.set(ranges, true), prose };
        },
        provide: field => EditorView.decorations.from(field, value => value.decorations)
    });
    const worker = ViewPlugin.fromClass(class {
        destroyed = false; observer: ResizeObserver; theme: MutationObserver; idle: ReturnType<typeof editorIdleScheduler>;
        constructor(readonly view: EditorView) {
            this.idle = editorIdleScheduler(view.dom, () => this.requestLayout(), 90);
            this.observer = new ResizeObserver(() => this.schedule()); this.observer.observe(view.contentDOM);
            this.theme = new MutationObserver(() => this.schedule());
            const doc = view.dom.ownerDocument;
            this.theme.observe(doc.body, { attributes: true, attributeFilter: ['class', 'style'] });
            this.theme.observe(doc.head, { childList: true, subtree: true, characterData: true, attributes: true });
            view.contentDOM.addEventListener('compositionstart', this.start);
            view.contentDOM.addEventListener('compositionend', this.end);
            view.dom.ownerDocument.fonts?.addEventListener('loadingdone', this.fonts);
            this.schedule();
        }
        start = () => { this.view.dispatch({ effects: composing.of(true) }); };
        end = () => { this.view.dispatch({ effects: composing.of(false) }); this.schedule(); };
        fonts = () => this.schedule();
        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet || update.viewportChanged || update.transactions.some(tr => tr.effects.some(effect => effect.is(plugin.refreshEffect)))) this.schedule();
        }
        schedule() {
            this.idle.schedule();
        }
        requestLayout() {
            if (this.destroyed) return;
            this.view.requestMeasure({ key: this, read: view => ({ doc: view.state.doc, plans: this.measure(view) }), write: result => {
                // requestMeasure writes run inside a view update. Dispatch only after it finishes,
                // and discard positions if the source changed while measurements were pending.
                queueMicrotask(() => { if (!this.destroyed && this.idle.isIdle() && this.view.state.doc === result.doc) this.view.dispatch({ effects: measured.of(result.plans) }); });
            } });
        }
        measure(view: EditorView) {
            if (!enabled(view.state) || view.composing || view.state.field(field).composing) return [];
            const context = view.dom.ownerDocument.win.createEl('canvas').getContext('2d'); if (!context) return [];
            const plans: Plan[] = [];
            let characters = 0;
            for (const paragraph of candidates(view.state)) {
                if (active(view.state, paragraph) || !view.visibleRanges.some(range => range.from <= paragraph.to && range.to >= paragraph.from)) continue;
                characters += paragraph.text.length; if (characters > 12000) break;
                const dom = view.domAtPos(paragraph.from + 1).node;
                const element = (dom.nodeType === 1 ? dom as HTMLElement : dom.parentElement)?.closest<HTMLElement>('.cm-line');
                if (!element) continue;
                const style = view.dom.ownerDocument.defaultView!.getComputedStyle(element);
                const indent = parseFloat(style.textIndent) || 0;
                if (style.direction !== 'ltr' || style.writingMode !== 'horizontal-tb' || indent < 0 || !style.textIndent.endsWith('px') || parseFloat(style.letterSpacing) || parseFloat(style.wordSpacing) || style.fontVariantCaps !== 'normal' || style.textAlign === 'center' || style.textAlign === 'right') continue;
                context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
                const width = element.getBoundingClientRect().width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
                if (width < 100) continue;
                const plan = planParagraph(paragraph.text, paragraph.from, width, context, parseFloat(style.fontSize) || 16, indent);
                if (plan) plans.push(plan);
                if (plans.length >= 40) break;
            }
            return plans;
        }
        destroy() {
            this.destroyed = true; this.idle.dispose(); this.observer.disconnect(); this.theme.disconnect();
            this.view.contentDOM.removeEventListener('compositionstart', this.start); this.view.contentDOM.removeEventListener('compositionend', this.end);
            this.view.dom.ownerDocument.fonts?.removeEventListener('loadingdone', this.fonts);
        }
    });
    return [field, worker, EditorView.editorAttributes.of(view => ({ class: [enabled(view.state) ? 'an-kp-native-justify' : '', plugin.settings.paragraphIndent && view.state.field(editorLivePreviewField, false) ? 'an-prose-indent-enabled' : ''].filter(Boolean).join(' ') }))];
}
