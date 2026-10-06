import { EditorState, StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField } from 'obsidian';
import { createLiveParagraphExtension } from '../src/typography/live';
import { DEFAULTS } from '../src/settings';

const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const settle = () => new Promise(resolve => setTimeout(resolve, 700));
function glyphRows(line: HTMLElement) {
    const rows: {top:number;left:number;right:number}[] = [];
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT), range = document.createRange();
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.parentElement?.closest('.an-kp-live-gap,.cm-widgetBuffer')) continue;
        for (let index = 0; index < node.length; index++) {
            if (/\s/.test(node.data[index])) continue;
            range.setStart(node,index); range.setEnd(node,index+1);
            const rect = range.getBoundingClientRect(); if (!rect.width || !rect.height) continue;
            let row = rows.find(row => Math.abs(row.top-rect.top)<2);
            if (!row) { row={top:rect.top,left:rect.left,right:rect.right}; rows.push(row); }
            else { row.left=Math.min(row.left,rect.left); row.right=Math.max(row.right,rect.right); }
        }
    }
    return rows.sort((a,b)=>a.top-b.top);
}
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
        plugin.settings.paragraphIndent = true; view.dispatch({ effects: plugin.refreshEffect.of(110) }); await settle(); await settle();
        const indentNode = view.domAtPos(englishFrom+1).node;
        const indentLine = (indentNode.nodeType===1 ? indentNode as HTMLElement : indentNode.parentElement)!.closest('.cm-line') as HTMLElement;
        const rows = glyphRows(indentLine), bounds = indentLine.getBoundingClientRect(), style = getComputedStyle(indentLine);
        check(rows.length>2 && Math.abs(rows[0].left-bounds.left-parseFloat(style.paddingLeft)-parseFloat(style.textIndent))<2, 'Inactive KP prose must indent visible first glyphs once');
        check(rows.slice(0,-1).every(row=>Math.abs(bounds.right-parseFloat(style.paddingRight)-row.right)<2), 'All indented non-final KP rows must reach the same actual right edge: '+JSON.stringify({rows,bounds:bounds.toJSON(),indent:style.textIndent}));
        plugin.settings.paragraphIndent = false; view.dispatch({ effects: plugin.refreshEffect.of(111) }); await settle();
        const count = breaks();
        const pos = englishFrom + 70;
        const coords = view.coordsAtPos(pos); check(coords, 'decorated text must retain position coordinates');
        check(Math.abs(view.posAtCoords({ x: coords!.left, y: (coords!.top + coords!.bottom) / 2 })! - pos) <= 1, 'text hit testing must map to original source offsets');
        view.dispatch({ selection: { anchor: pos } });
        check(breaks() < count, 'caret entry must synchronously restore its paragraph');
        const activeNode = view.domAtPos(pos).node;
        const activeLine = (activeNode.nodeType === 1 ? activeNode as HTMLElement : activeNode.parentElement)!.closest('.cm-line') as HTMLElement;
        check(getComputedStyle(activeLine).textAlign === 'justify', 'Active prose must retain native two-sided alignment');
        plugin.settings.paragraphIndent = true; view.dispatch({ effects: plugin.refreshEffect.of(100) });
        check(Math.abs(parseFloat(getComputedStyle(activeLine).textIndent) - 2 * parseFloat(getComputedStyle(activeLine).fontSize)) < 1, 'The optional first-line indent must be two em while editing');
        check(view.state.doc.toString() === source && view.state.selection.main.anchor === pos, 'Indentation must preserve source and caret');
        plugin.settings.paragraphIndent = false; view.dispatch({ effects: plugin.refreshEffect.of(101) });
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
        const tracking=host.createEl('style',{text:'.kp-live-test .cm-line{letter-spacing:1px;word-spacing:1.5px}'});
        await settle();await settle();
        check(breaks()>2,'Theme letter and word spacing must no longer disable live KP');
        const tracked=view.dom.querySelector<HTMLElement>('.cm-line:has(.an-kp-live-break)')!,trackedBounds=tracked.getBoundingClientRect(),trackedRows=glyphRows(tracked),trackedStyle=getComputedStyle(tracked);
        check(trackedRows.slice(0,-1).every(row=>Math.abs(trackedBounds.right-parseFloat(trackedStyle.paddingRight)-row.right)<2),'Tracked KP rows must fill the actual right edge: '+JSON.stringify({trackedRows,bounds:trackedBounds.toJSON()}));
        // Simulate WebKit versions whose canvas has no tracking properties.
        const getContext=HTMLCanvasElement.prototype.getContext;let legacyMeasurements=0;
        HTMLCanvasElement.prototype.getContext=function(...args:any[]){
            const context=(getContext as any).apply(this,args);if(args[0]!=='2d' || !context)return context;
            return new Proxy(context,{set:(target,key,value)=>Reflect.set(target,key,value,target),has:(target,key)=>key==='letterSpacing'||key==='wordSpacing'?false:key in target,get:(target,key)=>key==='measureText'?((text:string)=>{legacyMeasurements++;return target.measureText(text);}):typeof target[key]==='function'?target[key].bind(target):target[key]});
        } as any;
        try {
            tracking.textContent='.kp-live-test .cm-line{letter-spacing:0.7px;word-spacing:1.25px}';
            view.dispatch({effects:plugin.refreshEffect.of(112)});await settle();await settle();
            check(legacyMeasurements>20,'Legacy canvas test must actually recompute measured source');
            const fallback=view.dom.querySelector<HTMLElement>('.cm-line:has(.an-kp-live-break)')!,fallbackRows=glyphRows(fallback),fallbackBounds=fallback.getBoundingClientRect(),fallbackStyle=getComputedStyle(fallback);
            check(fallbackRows.slice(0,-1).every(row=>Math.abs(fallbackBounds.right-parseFloat(fallbackStyle.paddingRight)-row.right)<2),'Legacy WebKit tracking fallback must fill the actual right edge: '+JSON.stringify({fallbackRows,bounds:fallbackBounds.toJSON()}));
            check(view.state.doc.toString().includes(prose.slice(0,60)),'Tracking fallback must preserve source');
        }finally{HTMLCanvasElement.prototype.getContext=getContext;}
        tracking.remove();await settle();
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
        check(!view.dom.classList.contains('an-kp-native-justify') && !view.dom.classList.contains('an-prose-indent-enabled'), 'Disabling typography must remove native styling flags');
        plugin.settings.paragraphIndent = true; view.dispatch({ effects: plugin.refreshEffect.of(102) }); await settle();
        check(view.dom.classList.contains('an-prose-indent-enabled') && !!view.dom.querySelector('.an-prose-start') && breaks() === 0, 'Visual indentation must work independently while KP is disabled');
        plugin.settings.paragraphIndent = false; view.dispatch({ effects: plugin.refreshEffect.of(103) });
        check(view.state.doc.toString() === stableText, 'all layout and selection transactions must preserve source');
    } finally { view.destroy(); host.remove(); }
    const sourceHost = document.body.createDiv();
    const sourceView = new EditorView({ parent: sourceHost, state: EditorState.create({ doc: source, extensions: [EditorView.lineWrapping, createLiveParagraphExtension(plugin)] }) });
    try {
        plugin.settings.kpLivePreview = true; plugin.settings.paragraphIndent = true; sourceView.dispatch({ effects: plugin.refreshEffect.of(5) }); await settle();
        check(!sourceView.dom.querySelector('.an-kp-live-break'), 'source mode must remain native even when the setting is enabled');
        check(!sourceView.dom.classList.contains('an-prose-indent-enabled') && !sourceView.dom.querySelector('.an-prose-line'), 'Indentation must leave source mode untouched');
        check(sourceView.state.doc.toString() === source, 'source mode text must remain unchanged');
    } finally { sourceView.destroy(); sourceHost.remove(); }
    const boundaryHost=document.body.createDiv();boundaryHost.style.width='490px';
    const boundarySource='Before.\n\n$$\nx+y\n$$\nContinue without a blank.\n\nNew paragraph after a blank.';
    plugin.settings.paragraphIndent=true;plugin.settings.kpLivePreview=true;
    const boundaryView=new EditorView({parent:boundaryHost,state:EditorState.create({doc:boundarySource,extensions:[editorInfoField,editorLivePreviewField,EditorView.lineWrapping,createLiveParagraphExtension(plugin)]})});
    try {
      await settle();
      const paragraphs=[...boundaryView.dom.querySelectorAll<HTMLElement>('.cm-line')],continued=paragraphs.find(line=>line.textContent?.startsWith('Continue without'))!,newParagraph=paragraphs.find(line=>line.textContent?.startsWith('New paragraph'))!;
      check(continued.classList.contains('an-prose-line') && !continued.classList.contains('an-prose-start') && parseFloat(getComputedStyle(continued).textIndent)===0,'Editable continuation after a display equation must not repeat indentation');
      check(newParagraph.classList.contains('an-prose-start') && parseFloat(getComputedStyle(newParagraph).textIndent)>0,'An empty source line must restart editable-prose indentation');
      check(boundaryView.state.doc.toString()===boundarySource,'Source-boundary decorations must preserve text');
    }finally{boundaryView.destroy();boundaryHost.remove();plugin.settings.paragraphIndent=false;}
    return 'Live Preview KP: source preservation, native editing/selection/IME, hit testing, resizing and scroll stability passed';
}
