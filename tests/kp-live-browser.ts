import { EditorState, StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField } from 'obsidian';
import { createLiveParagraphExtension } from '../src/typography/live';
import { DEFAULTS } from '../src/settings';

const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const settle = () => new Promise(resolve => setTimeout(resolve, 700));
export async function runKpLiveRegressions() {
    const host = document.body.createDiv(); host.style.width = '490px';
    host.createEl('style', { text: '.kp-live-test .cm-editor{height:720px}.kp-live-test .cm-scroller{overflow:auto}' }); host.className = 'kp-live-test';
    const prose = 'A useful paragraph balances the spacing between words across the entire paragraph. We preserve the original source and let the editor handle selection, input and scrolling. Mathematical notes need reliable editing as well as careful typography. '.repeat(3).trim();
    const chinese = '数学笔记中的普通正文可以优化段落断行，让各行间距更均匀。进入段落后恢复编辑器原有排版，保留中文输入法与选择行为。'.repeat(6);
    const source = 'Start here.\n\n' + prose + '\n\n' + chinese + '\n\n' + 'Text with $x+y$ and [[link]] retains native layout. '.repeat(5) + '\n\n```text\n' + prose + '\n```\n\n' + 'Tail.\n\n'.repeat(40);
    const plugin: any = { settings: { ...DEFAULTS, kpLivePreview: true }, refreshEffect: StateEffect.define<number>() };
    const view = new EditorView({ parent: host, state: EditorState.create({ doc: source, extensions: [editorInfoField, editorLivePreviewField, EditorView.lineWrapping, createLiveParagraphExtension(plugin)] }) });
    try {
        await settle();
        for (let attempt = 0; attempt < 6 && view.dom.querySelectorAll('.an-kp-live-break').length <= 2; attempt++) { view.requestMeasure(); await settle(); }
        const diagnostic = [...view.dom.querySelectorAll<HTMLElement>('.cm-line')].slice(0, 6).map(line => { const s = getComputedStyle(line); return { width: line.getBoundingClientRect().width, length: line.textContent?.length, font: s.font, direction: s.direction, writingMode: s.writingMode, indent: s.textIndent, letters: s.letterSpacing, words: s.wordSpacing, caps: s.fontVariantCaps }; });
        check(view.dom.querySelectorAll('.an-kp-live-break').length > 2, 'inactive paragraphs must get optimized line breaks: ' + JSON.stringify({ visible: view.inView, composing: view.composing, ranges: view.visibleRanges, diagnostic }));
        check(view.state.doc.toString() === source, 'layout must preserve exact source');
        for (const line of view.dom.querySelectorAll('.cm-line')) if (line.textContent?.includes('$x+y$')) check(!line.querySelector('.an-kp-live-break'), 'inline math/link paragraphs must remain native');
        const englishFrom = source.indexOf(prose), chineseFrom = source.indexOf(chinese);
        const chineseNode = view.domAtPos(chineseFrom + 1).node;
        check((chineseNode.nodeType === 1 ? chineseNode as HTMLElement : chineseNode.parentElement)?.closest('.cm-line')?.querySelector('.an-kp-live-break'), 'visible CJK prose must get optimized breaks');
        const breaks = () => view.dom.querySelectorAll('.an-kp-live-break').length;
        const count = breaks();
        const pos = englishFrom + 70;
        const coords = view.coordsAtPos(pos); check(coords, 'decorated text must retain position coordinates');
        check(Math.abs(view.posAtCoords({ x: coords!.left, y: (coords!.top + coords!.bottom) / 2 })! - pos) <= 1, 'text hit testing must map to original source offsets');
        view.dispatch({ selection: { anchor: pos } });
        check(breaks() < count, 'caret entry must synchronously restore its paragraph');
        await settle();
        view.dispatch({ changes: { from: pos, insert: 'edited ' }, selection: { anchor: pos + 7 } });
        await settle();
        check(view.state.doc.toString() === source.slice(0, pos) + 'edited ' + source.slice(pos), 'typing must change only requested source');
        view.dispatch({ selection: { anchor: 0 } }); await settle();
        check(breaks() > 2, 'leaving an edited paragraph must optimize it again');
        view.dispatch({ selection: { anchor: englishFrom, head: chineseFrom + 7 + chinese.length } });
        check(breaks() === 0, 'cross-paragraph selection must immediately restore all selected prose');
        view.dispatch({ selection: { anchor: 0 } }); await settle();
        view.contentDOM.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        check(breaks() === 0, 'composition must restore native layout');
        view.contentDOM.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); await settle();
        check(breaks() > 2, 'layout must resume after composition');
        host.style.width = '360px'; await settle();
        check(breaks() > 2, 'resizing must rebuild line breaks');
        const line = view.dom.querySelector<HTMLElement>('.cm-line:has(.an-kp-live-break)');
        check(line && line.scrollWidth <= line.clientWidth + 2, 'optimized paragraph must not overflow');
        const stableText = view.state.doc.toString();
        view.scrollDOM.scrollTop = 80; view.requestMeasure(); await settle();
        const top = view.scrollDOM.scrollTop;
        check(top > 0, 'scroll fixture must actually scroll');
        for (let n = 0; n < 3; n++) { view.dispatch({ effects: plugin.refreshEffect.of(n) }); await settle(); }
        check(Math.abs(view.scrollDOM.scrollTop - top) < 2, 'idle refresh must preserve scroll position');
        plugin.settings.kpLivePreview = false; view.dispatch({ effects: plugin.refreshEffect.of(4) });
        check(breaks() === 0, 'disabling must synchronously restore native layout');
        check(view.state.doc.toString() === stableText, 'all layout and selection transactions must preserve source');
    } finally { view.destroy(); host.remove(); }
    const sourceHost = document.body.createDiv();
    const sourceView = new EditorView({ parent: sourceHost, state: EditorState.create({ doc: source, extensions: [EditorView.lineWrapping, createLiveParagraphExtension(plugin)] }) });
    try {
        plugin.settings.kpLivePreview = true; sourceView.dispatch({ effects: plugin.refreshEffect.of(5) }); await settle();
        check(!sourceView.dom.querySelector('.an-kp-live-break'), 'source mode must remain native even when the setting is enabled');
        check(sourceView.state.doc.toString() === source, 'source mode text must remain unchanged');
    } finally { sourceView.destroy(); sourceHost.remove(); }
    return 'Live Preview KP: source preservation, native editing/selection/IME, hit testing, resizing and scroll stability passed';
}
