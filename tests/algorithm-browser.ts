import { EditorState, StateField } from '@codemirror/state';
import { EditorView, Decoration, WidgetType } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField } from 'obsidian';
import { setMathOutput } from './browser-host';
import { setLanguage } from '../src/i18n';
import Engine from '../src/indexing/engine';
import { DEFAULTS } from '../src/settings';
import { algorithmProcessor, algorithmRecord, finishAlgorithms } from '../src/algorithms/render';
import { parseAlgorithm } from '../src/algorithms/model';
import { createLiveExtension, renderFragment } from '../src/rendering/adapters';
import DocCore from '../src/export/document';
import { layoutParagraphs } from '../src/typography/dom';
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const wait = () => new Promise(resolve => setTimeout(resolve, 220));
const body = '\\INPUT $a,b\\in\\mathbb{N}$\n\\WHILE{$b\\ne 0$}\n  \\STATE $(a,b)\\gets(b,a\\bmod b)$\n\\ENDWHILE\n\\RETURN $a$';
const full = '\\begin{algorithm}\n\\caption{Euclid}\n\\begin{algorithmic}\n' + body + '\n\\end{algorithmic}\n\\end{algorithm}';
function callout(parent: HTMLElement) {
    const box=parent.createDiv({cls:'callout',attr:{'data-callout':'algorithm'}});
    const title=box.createDiv({cls:'callout-title'}).createDiv({cls:'callout-title-inner',text:'Euclid'});
    box.createDiv({cls:'callout-content'}).createEl('p',{text:'Unrendered pseudocode'});
    return {box,title};
}
export async function runAlgorithmRegressions() {
    setLanguage('en');
    const host=document.body.createDiv({cls:'markdown-rendered'}); host.style.width='720px';
    const source='> [!algorithm] Euclid\n'+body.split('\n').map(line=>'> '+line).join('\n')+'\n\n^alg-callout\n\n```algorithm\n'+full+'\n```\n\n^alg-fence';
    const note=Engine.parse('live.md',source); const graph=Engine.graph([note]);
    const {box,title}=callout(host), fence=host.createDiv(); algorithmProcessor(full,fence,true);
    const info=(node:HTMLElement)=>node.closest('.callout')?{lineStart:note.media[0].line,lineEnd:note.media[0].endLine}:{lineStart:note.media[1].line,lineEnd:note.media[1].endLine};
    for(const mode of ['svg','chtml','failure'] as const) {
        setMathOutput(mode); box.removeAttribute('data-an-algorithm'); fence.removeAttribute('data-an-algorithm');
        renderFragment(host,note,graph,info); await finishAlgorithms(host);
        check(box.querySelectorAll('.an-algorithm-line').length===5,'Callout control flow must render all lines');
        check(box.querySelector('.an-algorithm-body')?.textContent===fence.querySelector('.an-algorithm-body')?.textContent,'Both wrappers must display the same algorithm');
        for(const math of host.querySelectorAll('.an-algorithm-math')) check(!!math.querySelector('svg,mjx-container'),'Algorithm formulas must render with native or local math on mobile');
        check(title.textContent==='Algorithm 1 · Euclid','Callout caption and counter');
    }
    setMathOutput('svg');
    for(const width of [320,720]) { host.style.width=width+'px'; await wait(); check([...host.querySelectorAll('.an-algorithm-line')].every(line=>line.getBoundingClientRect().right<=host.getBoundingClientRect().right+1),'Algorithm must fit a narrow mobile pane'); }
    const first=box.querySelector('.an-algorithm-line')!; renderFragment(host,note,graph,info); await finishAlgorithms(host); check(box.querySelector('.an-algorithm-line')===first,'Idle refresh must retain algorithm nodes');
    check(layoutParagraphs(host).processed===0,'Algorithms must not enter prose KP layout');
    const untrusted=host.createDiv(); algorithmProcessor('\\STATE <img src=x onerror=alert(1)>',untrusted,false); await finishAlgorithms(untrusted);
    check(!untrusted.querySelector('img,script,iframe')&&untrusted.textContent?.includes('<img'),'Algorithm strings must not become HTML');
    const broken=host.createDiv(); algorithmProcessor('\\WHILE{$a$}',broken,false); check(broken.classList.contains('an-algorithm-error'),'Syntax errors must be visible');
    const titleMath=host.createDiv(); algorithmProcessor(full.replace('Euclid','Euclid $\\alpha$'),titleMath,false); await finishAlgorithms(titleMath); check(!!titleMath.querySelector('.an-algorithm-caption .an-algorithm-math svg'),'Caption math must render');
    algorithmRecord(fence,note.media[1],true); await finishAlgorithms(fence); check([...fence.querySelectorAll('.an-algorithm-line-number')].map(n=>n.textContent).join(',')===',1,2,3,4','IO does not consume a line number');
    const controls=host.createDiv(); algorithmProcessor(`
\\INPUT $a$
\\PROCEDURE{Search}{$a$}
\\IF{$a>0$}
  \\STATE \\CALL{Visit}{$a$}
\\ELSIF{$a=0$}
  \\RETURN \\TRUE
\\ELSE
  \\BREAK
\\ENDIF
\\FORALL{$x\\in A$}
  \\CONTINUE
\\ENDFOR
\\REPEAT
  \\PRINT $x$
\\UNTIL{$x=0$}
\\UPON{event}
  \\STATE \\textbf{ready} {\\scriptsize small} \\COMMENT{done}
\\ENDUPON
\\ENDPROCEDURE`,controls,true); await finishAlgorithms(controls);
    check(!controls.classList.contains('an-algorithm-error'),'Supported procedure, branch, loop and comment grammar must render');
    const controlText=controls.textContent!;
    for(const word of ['procedure','Search','Visit','else if','for all','continue','repeat','until','upon','ready','done','end procedure']) check(controlText.includes(word),'Missing control-flow content: '+word);
    check(controls.querySelectorAll('.an-algorithm-line').length>=18&&!!controls.querySelector('.an-algorithm-comment'),'Control-flow rows and inline comments must be retained');
    check(!controls.querySelector('[style*="font-size"].an-algorithm-smallcaps'),'Font-size commands must not accidentally enable small caps');
    const markup=box.outerHTML;
    host.remove();

    // A real CodeMirror read-only widget with the native editable title retained.
    const parent=document.body.createDiv(); parent.style.width='520px';
    const calloutSource=source.slice(0,source.indexOf('\n\n^alg-callout'))+'\n\nTail.'.repeat(20), liveNote=Engine.parse('live.md',calloutSource), liveGraph=Engine.graph([liveNote]);
    let liveBox:HTMLElement, liveTitle:HTMLElement;
    class NativeAlgorithm extends WidgetType { toDOM(){ const generated=callout(document.createElement('div')); liveBox=generated.box; liveTitle=generated.title; liveBox.contentEditable='false'; liveTitle.contentEditable='true'; return liveBox; } }
    const field=StateField.define({create:()=>Decoration.set([Decoration.replace({widget:new NativeAlgorithm(),block:true}).range(0,liveNote.media[0].to)]),update:(value,tr)=>value.map(tr.changes),provide:field=>EditorView.decorations.from(field)});
    const errors:unknown[]=[], plugin:any={settings:{...DEFAULTS},graph:liveGraph,editorViews:new Set(),recordError:(...args:unknown[])=>errors.push(args)};
    const view=new EditorView({parent,state:EditorState.create({doc:calloutSource,selection:{anchor:calloutSource.length},extensions:[editorInfoField,editorLivePreviewField,field,createLiveExtension(plugin)]})});
    try {
        for(let n=0;n<15&&!liveBox!.querySelector('.an-algorithm-line');n++) await wait();
        await finishAlgorithms(liveBox!); check(!!liveBox!.querySelector('.an-algorithm-line'),'Inactive Live Preview callout must render');
        check(liveTitle!.textContent==='Euclid'&&liveTitle!.isContentEditable,'Native editable title must retain its text and editor ownership');
        const old=liveBox!.querySelector('.an-algorithm-line'); let mutations=0; const observer=new MutationObserver(records=>{mutations+=records.length}); observer.observe(liveBox!,{subtree:true,childList:true});
        for(let n=0;n<3;n++){view.dispatch({effects:plugin.refreshEffect.of(n)});await wait();}
        observer.disconnect(); check(mutations===0&&old===liveBox!.querySelector('.an-algorithm-line'),'Idle refresh must not repeatedly rebuild an editor widget');
        liveTitle!.focus(); const before=liveBox!.innerHTML; view.dispatch({effects:plugin.refreshEffect.of(10)}); await wait(); check(liveBox!.innerHTML===before,'Title editing must not rewrite native DOM');
        liveTitle!.blur(); document.getSelection()?.removeAllRanges();
        check(errors.length===0,'No CodeMirror or rendering errors');
    } finally {view.destroy();parent.remove();}

    // Two exported chapters preserve the algorithm anchor and forward/back references.
    const root=document.body.createEl('main'); root.id='phb-document'; root.className='markdown-rendered';
    const chapter=root.createEl('section',{cls:'phb-chapter',attr:{'data-path':'one.md','data-title':'One'}}), two=root.createEl('section',{cls:'phb-chapter',attr:{'data-path':'two.md','data-title':'Two'}});
    const target=two.createDiv(); algorithmProcessor(full,target,true); const alg=Engine.parse('two.md','```algorithm\n'+full+'\n```\n\n^alg-euclid'); Engine.graph([alg],{},undefined,new Map([['two.md',{chapter:2,mode:'chapter'}]])); algorithmRecord(target,alg.media[0],true); target.dataset.phbBlock='alg-euclid';
    const link=chapter.createEl('a',{cls:'internal-link',text:'alg 2.1',attr:{href:'two#^alg-euclid'}});
    await finishAlgorithms(root); const meta=DocCore.prepare(root,{preNumbered:true,toc:false,book:false});
    check(link.dataset.phbResolved===target.id&&!meta.warnings.length,'Exported cross-file algorithm link must resolve to its actual box');
    const long=two.createDiv(); algorithmProcessor('\\begin{algorithm}\n\\caption{Long algorithm}\n\\begin{algorithmic}\n'+Array.from({length:100},(_,n)=>'\\STATE row-'+String(n).padStart(3,'0')).join('\n')+'\n\\end{algorithmic}\n\\end{algorithm}',long,true); await finishAlgorithms(root);
    const pdfMarkup=root.outerHTML+'<script id="phb-meta" type="application/json">'+JSON.stringify(meta)+'</script>'; root.remove();
    return {message:'Algorithms: equivalent wrappers, math fallback, narrow panes, native title editing, idle DOM stability and cross-file export anchors passed.',markup,pdfMarkup};
}
