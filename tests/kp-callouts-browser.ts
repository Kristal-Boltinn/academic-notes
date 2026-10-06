import { markMathContinuations } from '../src/typography/continuations';
import { layoutParagraphs, restoreParagraphs } from '../src/typography/dom';
import { renderMath, editorInfoField, editorLivePreviewField } from 'obsidian';
import { EditorState, StateField, StateEffect } from '@codemirror/state';
import { EditorView, WidgetType, Decoration } from '@codemirror/view';
import { createLiveExtension } from '../src/rendering/adapters';
import { createLiveParagraphExtension } from '../src/typography/live';
import Engine from '../src/indexing/engine';
import { DEFAULTS } from '../src/settings';
import { LayoutRecorder } from '../src/diagnostics/layout';
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const prose = 'A mathematical proof considers a sequence of related statements. We choose an open neighborhood and apply continuity to the inverse image, preserving the hypotheses at every step. The final conclusion follows from the lemma and the definition. ';
export async function runCalloutTypographyRegressions() {
    const host = document.body.createDiv({ cls: 'markdown-rendered' });
    let example = '';
    const hadIndent=document.body.classList.contains('an-prose-indent');document.body.classList.add('an-prose-indent');
    try {
      for(const quoted of [false,true]) {
        const text=prose.repeat(3),prefix=quoted?'> ':'';
        const source=(quoted?'> [!proof]\n':'')+[text,'$$','x+y','$$',text,'',text,'$$','z','$$','',text].map(line=>prefix+line).join('\n');
        const note=Engine.parse('paragraphs.md',source),root=quoted?host.createDiv({cls:'callout an-proof-own-line',attr:{'data-callout':'proof'}}):host.createDiv();
        if(quoted)root.createDiv({cls:'callout-title'}).createDiv({cls:'callout-title-inner',text:'Proof'});
        const content=quoted?root.createDiv({cls:'callout-content'}):root;host.style.width='720px';
        const first=content.createEl('p',{text});content.createDiv({cls:'math-block'}).appendChild(renderMath('x+y',true));
        const continued=content.createEl('p',{text}),newParagraph=content.createEl('p',{text});content.createDiv({cls:'math-block'}).appendChild(renderMath('z',true));
        const separated=content.createEl('p',{text});
        markMathContinuations(root,note);
        check(continued.classList.contains('an-prose-continuation') && !separated.classList.contains('an-prose-continuation'),'Only an explicit source blank starts a new paragraph after math');
        const originals=[first,continued,newParagraph,separated].map(p=>p.textContent),formulaNodes=[...root.querySelectorAll('mjx-container')];
        for(const copy of [root,root.cloneNode(true) as HTMLElement]) {
          if(copy!==root)host.appendChild(copy);
          const paragraphs=[...copy.querySelectorAll<HTMLElement>('p')];
          check(parseFloat(getComputedStyle(paragraphs[1]).textIndent)===0 && parseFloat(getComputedStyle(paragraphs[3]).textIndent)>0,'Native reading and serialized export CSS must preserve source boundaries');
          check(layoutParagraphs(copy).processed===4,'Source-boundary fixture must also use KP');
          const firstGlyphOffset=(p:HTMLElement)=>{const range=document.createRange();range.selectNode(p.querySelector('.an-kp-line')!.firstChild!);return range.getBoundingClientRect().left-p.getBoundingClientRect().left;};
          check(Math.abs(firstGlyphOffset(paragraphs[1]))<2,'KP continuation must place its first glyph at the normal left edge');
          check(Math.abs(firstGlyphOffset(paragraphs[3])-2*parseFloat(getComputedStyle(paragraphs[3]).fontSize))<2,'KP after a source blank must place its first glyph two em from the left edge');
          restoreParagraphs(copy);check(paragraphs.every((p,index)=>p.textContent===originals[index]),'Boundary marking and KP must preserve text');
          if(copy!==root)copy.remove();
        }
        check(formulaNodes.every((node,index)=>root.querySelectorAll('mjx-container')[index]===node),'Paragraph classification must retain formula nodes');
        const edited=Engine.parse('paragraphs.md',source.replace('$$\n'+prefix+text,'$$\n'+prefix+'\n'+prefix+text));
        markMathContinuations(root,edited);check(!continued.classList.contains('an-prose-continuation'),'Adding a source blank must remove the old continuation marker');
        root.remove();
      }
    }finally{if(!hadIndent)document.body.classList.remove('an-prose-indent');}
    try {
        for (const type of ['proof', 'pf', 'remark', 'rem', 'thm', 'def']) for (const width of [340, 720, 900]) for (const spacing of [0, 1]) {
            host.style.width = width + 'px';
            const box = host.createDiv({ cls: 'callout', attr: { 'data-callout': type } });
            const title = box.createDiv({ cls: 'callout-title' });
            title.createDiv({ cls: 'callout-title-inner' }).createSpan({ cls: 'phb-type-label', text: ['proof', 'pf'].includes(type) ? 'Proof' : type === 'thm' ? 'Theorem 1.1' : type === 'def' ? 'Definition 1.1' : 'Remark' });
            const content = box.createDiv({ cls: 'callout-content' });
            const p = content.createEl('p'); p.style.letterSpacing = spacing + 'px'; p.append(prose.repeat(2));
            const link = p.createEl('a', { text: 'the preceding lemma', attr: { href: '#lemma', 'data-href': '#lemma' } });
            p.append(' ');
            const formula = p.createSpan({ cls: 'math' }); formula.appendChild(renderMath('f^{-1}(U) \\subseteq X', false));
            formula.style.cssText = 'position:relative;display:inline-block';
            formula.createSpan({ text: 'accessible formula', attr: { style: 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden' } });
            p.append(' completes the proof. ' + '数学论证的断行应该考虑整个段落，并保持公式和引用完整。'.repeat(3));
            const original = [...p.childNodes], before = p.outerHTML, text = p.textContent;
            const selection = document.getSelection()!, nativeRange = document.createRange(); selection.removeAllRanges(); nativeRange.selectNodeContents(p); selection.addRange(nativeRange);
            const nativeCopy = selection.toString(); selection.removeAllRanges();
            // Model the device report: measured text fragments can be wider than
            // the final shaped line. Test the actual rendered right edge, not a sum.
            const rangeRect = Range.prototype.getBoundingClientRect;
            if (type === 'proof' && width === 900 && spacing === 1) Range.prototype.getBoundingClientRect = function () {
                const rect = rangeRect.call(this);
                return this.startContainer.parentElement?.closest('.an-kp-measure') ? new DOMRect(rect.x, rect.y, rect.width + .6, rect.height) : rect;
            };
            let result;
            try { result = layoutParagraphs(box); }
            finally { Range.prototype.getBoundingClientRect = rangeRect; }
            check(result.processed === 1, `${type}/${width}: callout prose must use KP: ${JSON.stringify(result)}`);
            const lines = [...p.querySelectorAll<HTMLElement>(':scope > .an-kp-line')];
            check(lines.length > 2 && lines.every(line => line.scrollWidth <= line.getBoundingClientRect().width + 2), `${type}/${width}: all lines must fit`);
            for (const line of lines.slice(0, -1)) {
                const last = [...line.childNodes].reverse().find(node => node.nodeType === 3 && !!node.textContent?.trim() || node.nodeType === 1 && !(node as Element).matches('.an-kp-space'))!;
                const range = document.createRange(); range.selectNode(last);
                const right = last.nodeType === 1 ? (last as Element).getBoundingClientRect().right : range.getBoundingClientRect().right;
                check(Math.abs(right - line.getBoundingClientRect().right) < 2, `${type}/${width}/${spacing}px tracking: each non-final line must actually align at the right edge: ${line.getBoundingClientRect().right - right}px`);
            }
            check(p.textContent === text && p.querySelector('a') === link && p.querySelector('.math') === formula, 'Text, original links and formulas must remain intact');
            const proof = ['proof', 'pf'].includes(type);
            const marks = [getComputedStyle(p, '::after').content, ...lines.map(line => getComputedStyle(line, '::after').content)].filter(value => value.includes('□'));
            check(marks.length === (proof ? 1 : 0), 'A proof must have one final QED; other environments must have none');
            if (getComputedStyle(title).cssFloat === 'left') {
                check(lines[0].getBoundingClientRect().left >= title.getBoundingClientRect().right - 1, 'The first line must begin after its floating title');
                check(Math.abs(lines[1].getBoundingClientRect().left - p.getBoundingClientRect().left) < 2, 'Subsequent lines must return to full paragraph width');
            }
            if (proof && width === 720 && type === 'proof') example = box.outerHTML;
            const range = document.createRange(); range.selectNodeContents(p); selection.addRange(range);
            check(selection.toString() === nativeCopy, 'Copying callout prose must preserve native formula copying without adding the generated QED or visual newlines: ' + JSON.stringify({ native: nativeCopy, optimized: selection.toString() })); selection.removeAllRanges();
            restoreParagraphs(box);
            check(p.outerHTML === before && original.every((node, index) => p.childNodes[index] === node), 'Native nodes and marker must restore exactly');
            box.classList.add('an-proof-own-line');
            check(layoutParagraphs(box).processed === 1, 'Own-line headings must also support KP');
            if (proof) check(getComputedStyle(title).cssFloat === 'none', 'An own-line Proof title must remain on its own line');
            restoreParagraphs(box); box.remove();
        }
    } finally { restoreParagraphs(host); host.remove(); document.getSelection()?.removeAllRanges(); }
    await formulaEnds();
    await indentCallouts();
    await liveCallout();
    return { message: 'Callout KP: Proof/Remark/theorem/definition, first-line width, QED, math/link/copy identity, native editing and inert Live Preview refreshes passed', markup: example };
}

async function indentCallouts() {
    const host = document.body.createDiv({cls:'markdown-rendered'}); host.style.width='720px';
    const hadIndent=document.body.classList.contains('an-prose-indent'); document.body.classList.add('an-prose-indent');
    try {
        for (const type of ['proof','remark','thm']) {
            const box=host.createDiv({cls:'callout',attr:{'data-callout':type}});
            box.createDiv({cls:'callout-title'}).createDiv({cls:'callout-title-inner',text:type});
            const p=box.createDiv({cls:'callout-content'}).createEl('p',{text:prose.repeat(3)});
            const indent=2*parseFloat(getComputedStyle(p).fontSize);
            check(Math.abs(parseFloat(getComputedStyle(p).textIndent)-indent)<1, 'The global indent option must reach native '+type+' prose');
            const original=p.outerHTML;
            check(layoutParagraphs(box).processed===1, 'Indented '+type+' must optimize');
            const rows=[...p.querySelectorAll<HTMLElement>(':scope > .an-kp-line')], edge=p.getBoundingClientRect().right;
            for (const row of rows.slice(0,-1)) {
                const last=[...row.childNodes].reverse().find(node=>node.nodeType===3 && !!node.textContent?.trim());
                const range=document.createRange(); range.selectNode(last!);
                check(Math.abs(range.getBoundingClientRect().right-edge)<2, 'Indented '+type+' non-final text must reach the paragraph right edge');
            }
            restoreParagraphs(box); check(p.outerHTML===original,'Indented callout must restore exactly'); box.remove();
        }
    } finally { restoreParagraphs(host);host.remove();if(!hadIndent)document.body.classList.remove('an-prose-indent'); }
}

async function formulaEnds() {
    const host = document.body.createDiv({ cls: 'markdown-rendered' });
    const box = host.createDiv({ cls: 'callout an-proof-own-line', attr: { 'data-callout': 'proof' } });
    box.createDiv({ cls: 'callout-title' }).createDiv({ cls: 'callout-title-inner', text: 'Proof' });
    const p = box.createDiv({ cls: 'callout-content' }).createEl('p');
    const formulas: HTMLElement[] = [];
    for (let n = 0; n < 8; n++) {
        p.append('By the preceding lemma we conclude that ');
        const math = p.createSpan({ cls: 'math' }); math.style.cssText = 'display:inline-block;margin-right:14px';
        math.appendChild(renderMath('f^{-1}(U) \\subseteq X', false)); formulas.push(math);
        if (n < 7) p.append(' ');
    }
    host.style.width = '1000px';
    p.style.width = '440px';
    const original = [...p.childNodes], before = p.outerHTML;
    const recorder = new LayoutRecorder(document, () => host, () => ({ pluginVersion: 'test', appVersion: 'test', ios: false, android: false, kpReading: true, kpLivePreview: true, livePreview: true }));
    try {
        const endingRows = () => [...p.querySelectorAll<HTMLElement>(':scope > .an-kp-line')].slice(0, -1).filter(line => {
            const last = [...line.childNodes].reverse().find(node => node.nodeType === 3 && !!node.textContent?.trim() || node.nodeType === 1 && !(node as Element).matches('.an-kp-space'));
            return last?.nodeType === 1 && (last as Element).matches('.math,.an-kp-math-end');
        });
        let formulaRows: HTMLElement[] = [];
        // Sweep font-dependent widths rather than assuming one platform's glyph metrics.
        for (let width = 320; width <= 850 && formulaRows.length < 2; width += 10) {
            restoreParagraphs(box); p.style.width = width + 'px';
            layoutParagraphs(box); formulaRows = endingRows();
        }
        check(formulaRows.length >= 2, 'The fixture must exercise multiple formula-ending non-final rows');
        for (const line of formulaRows) {
            const math = line.querySelector<HTMLElement>(':scope > .an-kp-math-end > .math')!;
            check(Math.abs(line.getBoundingClientRect().right - math.getBoundingClientRect().right) < 2, 'The visible formula must reach the actual non-final right edge');
        }
        check(formulas.every(math => p.contains(math) && math.style.marginRight === '14px'), 'Theme margins and original formula nodes must remain restorable');
        restoreParagraphs(box);
        p.style.width = '440px';
        check(p.outerHTML === before && original.every((node, index) => node === p.childNodes[index]), 'Formula ending layout must restore exact nodes and styles');
    } finally { recorder.stop(); restoreParagraphs(box); host.remove(); }
}

async function liveCallout() {
    const host = document.body.createDiv(); host.style.width = '520px';
    const text = prose.repeat(3), source = '> [!proof]\n> ' + text + '\n\nAfter the proof.' + '\n\nTail.'.repeat(80);
    const note = Engine.parse('live.md', source), graph = Engine.graph([note]);
    let box: HTMLElement, p: HTMLElement, title: HTMLElement;
    class NativeCallout extends WidgetType {
        toDOM() {
            box = document.createElement('div'); box.className = 'callout markdown-rendered'; box.dataset.callout = 'proof'; box.contentEditable = 'false';
            title = box.createDiv({ cls: 'callout-title' }).createDiv({ cls: 'callout-title-inner', text: 'Proof' });
            title.contentEditable = 'true';
            p = box.createDiv({ cls: 'callout-content' }).createEl('p', { text }); p.style.whiteSpace = 'normal';
            return box;
        }
    }
    const widgets = StateField.define({ create: () => Decoration.set([Decoration.replace({ widget: new NativeCallout(), block: true }).range(0, source.indexOf('\n\n'))]), update: (value, tr) => value.map(tr.changes), provide: field => EditorView.decorations.from(field) });
    const errors: unknown[] = [], plugin: any = { settings: { ...DEFAULTS, kpLivePreview: true }, graph, editorViews: new Set(), recordError: (...error: unknown[]) => errors.push(error) };
    const view = new EditorView({ parent: host, state: EditorState.create({ doc: source, selection: { anchor: source.length }, extensions: [editorInfoField, editorLivePreviewField, widgets, createLiveExtension(plugin), createLiveParagraphExtension(plugin)] }) });
    // Match the host's constrained editor viewport, rather than CM's bare min-content sizing.
    view.contentDOM.style.minWidth = '0'; view.contentDOM.style.width = '100%'; view.contentDOM.style.flex = '1 1 auto';
    const settle = () => new Promise(resolve => setTimeout(resolve, 220));
    try {
        for (let n = 0; n < 24 && !p!.querySelector('.an-kp-line'); n++) await settle();
        if (!p!.querySelector('.an-kp-line')) {
            const style = getComputedStyle(p!);
            throw new Error('Read-only Proof layout failed: ' + JSON.stringify({ errors, width: p!.getBoundingClientRect().width, whitespace: style.whiteSpace, indent: style.textIndent, align: style.textAlign, display: style.display, lineHeight: style.lineHeight, title: title!.parentElement!.getBoundingClientRect().toJSON(), paragraph: p!.getBoundingClientRect().toJSON() }));
        }
        let mutations = 0; const observer = new MutationObserver(records => { mutations += records.length; }); observer.observe(p!, { childList: true, attributes: true, subtree: true });
        for (let n = 0; n < 4; n++) { view.dispatch({ effects: plugin.refreshEffect.of(n) }); await settle(); }
        observer.disconnect(); check(mutations === 0, 'Idle read-only callout refreshes must not rewrite optimized DOM');
        const selection = document.getSelection()!, range = document.createRange(); range.selectNodeContents(p!); selection.removeAllRanges(); selection.addRange(range);
        const selected = selection.toString(), lines = [...p!.childNodes];
        host.style.width = '460px'; view.dispatch({ effects: plugin.refreshEffect.of(8) }); await settle();
        check(selection.toString() === selected && lines.every((node, index) => p!.childNodes[index] === node), 'Reflow must defer while read-only callout text is selected for copying');
        selection.removeAllRanges(); await settle();
        check(!!p!.querySelector('.an-kp-line'), 'Reflow must resume after copying ends');
        view.dispatch({ selection: { anchor: 5 } }); await settle();
        check(!p!.querySelector('.an-kp-line') && p!.textContent === text, 'Entering a callout must restore its native body');
        title!.contentEditable = 'true'; title!.focus(); title!.textContent = 'Edited title'; const node = title!.firstChild!;
        document.getSelection()!.setPosition(node, 4);
        for (let n = 0; n < 3; n++) { view.dispatch({ effects: plugin.refreshEffect.of(n + 10) }); await settle(); }
        check(title!.firstChild === node && document.getSelection()!.anchorNode === node, 'KP must not replace an editable native title or its caret');
        title!.blur();
        const nativeAfterBlur = p!.outerHTML;
        view.dispatch({ effects: plugin.refreshEffect.of(19) }); await settle();
        check(title!.firstChild === node && p!.outerHTML === nativeAfterBlur, 'The retained native DOM caret must protect the entire callout after blur');
        document.getSelection()!.removeAllRanges();
        view.dispatch({ selection: { anchor: source.length }, effects: plugin.refreshEffect.of(20) }); await settle();
        check(!!p!.querySelector('.an-kp-line'), 'Leaving the native callout must optimize its body again');
        const beforeTouch = [...p!.childNodes];
        const down = new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch', cancelable: true });
        check(view.dom.dispatchEvent(down), 'Scrolling touch must not be prevented');
        host.style.width = '420px';
        for (let n = 0; n < 4; n++) { view.dispatch({ effects: plugin.refreshEffect.of(30 + n) }); await settle(); }
        check(beforeTouch.every((child, index) => p!.childNodes[index] === child), 'Refreshes must not replace callout body nodes while a finger is down');
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch' }));
        await settle(); await settle();
        check(!!p!.querySelector('.an-kp-line') && p!.textContent === text, 'Layout must resume after touch scrolling settles');
        view.dom.style.height = '220px'; view.scrollDOM.style.overflow = 'auto';
        view.scrollDOM.scrollTop = 250; await settle(); await settle();
        const scrollTop = view.scrollDOM.scrollTop; check(scrollTop > 0, 'A proof editor must actually scroll after editing');
        for (let n = 0; n < 4; n++) { view.dispatch({ effects: plugin.refreshEffect.of(40 + n) }); await settle(); }
        check(Math.abs(view.scrollDOM.scrollTop - scrollTop) < 2, 'Idle proof refreshes must preserve the post-edit scroll position');
        plugin.settings.kpLivePreview = false; view.dispatch({ effects: plugin.refreshEffect.of(21) }); await settle();
        check(!p!.querySelector('.an-kp-line') && p!.textContent === text, 'Disabling KP must restore a read-only callout');
        check(view.state.doc.toString() === source && !errors.length, 'Read-only layout must not change Markdown or raise errors');
        plugin.settings.kpLivePreview = true; view.dispatch({ effects: plugin.refreshEffect.of(22) }); await settle();
        check(!!p!.querySelector('.an-kp-line'), 'Re-enabling callout layout must work');
        view.dispatch({ effects: StateEffect.reconfigure.of([editorInfoField, editorLivePreviewField, widgets]) });
        check(!p!.querySelector('.an-kp-line'), 'Removing the extension must restore native callout content');
    } finally { view.destroy(); host.remove(); }
}
