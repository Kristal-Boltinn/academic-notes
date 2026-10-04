import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import { exportPdf } from '../src/export/pdf';
import { measurePdf, PROBE } from '../src/export/pdf-postprocess';
import typographySource from 'academic-typography-client';

/** Verify paragraph fragmentation using positions in real PDFs rather than screen geometry. */
export async function runKpPdfRegressions(win: BrowserWindow, html: (body: string, css?: string) => string, printCss: string, client: string) {
    const sentence = 'A paragraph is a sequence of related ideas. Mathematical writing benefits from a careful choice of line breaks, because the paragraph can be considered as a whole. Local choices sometimes create awkward gaps, while a global search can balance the spacing across several lines. ';
    const pageHeight = (297 - 18 - 20) * 96 / 25.4;
    const fixtureCss = `
      body.phb-export #phb-document { font:22px/34px Arial,sans-serif!important; }
      body.phb-export #phb-document h1 { font:20px/40px Arial,sans-serif!important; height:40px!important; margin:0!important; padding:0!important; border:0!important; text-indent:0!important; }
      body.phb-export #phb-document [data-kp-fixture] { font:22px/34px Arial,sans-serif!important; width:100%!important; margin:0!important; padding:0!important; border:0!important; text-align:left!important; text-indent:0!important; white-space:normal; }
      body.phb-export #phb-document [data-kp-fixture] a { font:inherit!important; display:inline!important; margin:0!important; padding:0!important; border:0!important; }
      body.phb-export #phb-document [data-kp-spacer] { display:block!important; margin:0!important; padding:0!important; border:0!important; break-inside:avoid!important; }
    `;
    for (const mode of ['widow', 'orphan', 'proof'] as const) {
        const repetitions = mode === 'widow' ? 6 : 9;
        const contents = sentence.repeat(repetitions) + '<a class="internal-link" data-href="#starting-lemma" href="#starting-lemma">The starting lemma</a> completes this explanation.' +
            (mode === 'proof' ? ' The map <span class="math"><svg xmlns="http://www.w3.org/2000/svg" width="60" height="28" viewBox="0 0 60 28"><text x="0" y="22" font-size="22">f(x)</text></svg></span> is continuous.' : '');
        const paragraph = '<p data-kp-fixture>' + contents + '</p>';
        const body = mode === 'proof' ? '<div class="callout an-proof-own-line" data-callout="proof"><div class="callout-title"><div class="callout-title-inner">Proof</div></div><div class="callout-content">' + paragraph + '</div></div>' : paragraph;
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html(
            '<main id="phb-document" class="markdown-rendered"><section class="phb-chapter" data-path="pagination.md" data-title="Paragraph pagination"><h1 id="starting-lemma">Paragraph pagination</h1><div data-kp-spacer></div>' + body + '</section></main>',
            printCss + fixtureCss)));
        const wc = win.webContents;
        await wc.executeJavaScript(`Object.defineProperty(Document.prototype,'win',{get(){return this.defaultView}});window.createEl=tag=>document.createElement(tag);window.createDiv=()=>document.createElement('div');window.createSpan=()=>document.createElement('span');void 0;`);
        await wc.executeJavaScript(client);
        await wc.executeJavaScript(typographySource);
        const fixture = await wc.executeJavaScript(`(async()=>{
            document.body.classList.add('phb-export'); await document.fonts.ready;
            const root=document.getElementById('phb-document'),p=root.querySelector('[data-kp-fixture]');
            const meta=AcademicTestDoc.prepare(root,{toc:false,book:false,title:'Paragraph pagination'});
            const originalText=p.textContent,link=p.querySelector('a');
            const report=AcademicParagraphLayout.layoutParagraphs(root),lines=[...p.querySelectorAll(':scope > .an-kp-line')];
            if(report.processed!==1||lines.length<4) throw new Error('Pagination fixture did not produce optimized lines: '+JSON.stringify(report));
            if(p.textContent!==originalText||p.querySelector('a')!==link||!link.dataset.phbResolved) throw new Error('Dry layout lost source text or its resolved link');
            const height=lines[0].getBoundingClientRect().height,paragraphHeight=p.getBoundingClientRect().height;
            const headingHeight=root.querySelector('h1').getBoundingClientRect().height;
            const proofLeading=${JSON.stringify(mode)}==='proof'?p.getBoundingClientRect().top-root.querySelector('[data-kp-spacer]').getBoundingClientRect().bottom:0;
            AcademicParagraphLayout.restoreParagraphs(root);
            const free=${JSON.stringify(mode)}==='widow'?(lines.length-1+.4)*height:1.4*height;
            const spacerHeight=${pageHeight}-headingHeight-proofLeading-free;
            if(spacerHeight<=0) throw new Error('Fixture does not leave a controlled page boundary');
            root.querySelector('[data-kp-spacer]').style.height=spacerHeight+'px';
            const script=document.createElement('script');script.id='phb-meta';script.type='application/json';script.textContent=JSON.stringify(meta);document.body.appendChild(script);
            return {source:'<!doctype html>'+document.documentElement.outerHTML,text:originalText,count:lines.length,height:paragraphHeight};
        })()`) as { source: string; text: string; count: number; height: number };
        if (mode !== 'widow') assert.ok(fixture.height > pageHeight, 'The orphan/proof fixture must be longer than one page to test a genuine split');
        else assert.ok(fixture.height < pageHeight, 'The widow fixture must allow exactly one remaining line without widow protection');

        let captured: { count: number; text: string; widthsFit: boolean; linkResolved: boolean; qed: number } | undefined;
        let measured: Awaited<ReturnType<typeof measurePdf>> | undefined;
        class ProbedWindow extends BrowserWindow {
            constructor(options: BrowserWindowConstructorOptions) {
                super(options);
                const output = this.webContents, nativePrint = output.printToPDF.bind(output);
                output.printToPDF = async options => {
                    if (!captured) captured = await output.executeJavaScript(`(()=>{
                        const p=document.querySelector('[data-kp-fixture]'),lines=[...p.querySelectorAll(':scope > .an-kp-line')],link=p.querySelector('a');
                        const qed=[getComputedStyle(p,'::after').content,...lines.map(line=>getComputedStyle(line,'::after').content)].filter(value=>value.includes('□')).length;
                        const result={count:lines.length,text:p.textContent,widthsFit:lines.every(line=>line.scrollWidth<=line.getBoundingClientRect().width+2),linkResolved:!!link?.dataset.phbResolved&&link.getAttribute('href')==='#'+link.dataset.phbResolved,qed};
                        lines.forEach((line,index)=>{
                            const marker=document.createElement('a');marker.className='phb-probe kp-line-probe';marker.setAttribute('aria-hidden','true');marker.href=${JSON.stringify(PROBE + 'kp-' + mode + '-line-')}+index;marker.textContent='.';
                            marker.style.cssText='position:relative!important;display:inline-block!important;top:auto!important;left:auto!important;width:1px!important;height:1px!important;font:1px/1px Arial!important;margin-left:-1px!important;vertical-align:baseline!important;padding:0!important;border:0!important';
                            line.appendChild(marker);
                        });
                        return result;
                    })()`) as typeof captured;
                    const bytes = await nativePrint(options);
                    measured = await measurePdf(bytes);
                    return bytes;
                };
            }
        }
        const result = await exportPdf(fixture.source, () => {}, undefined, ProbedWindow, { kp: true });
        assert.ok(captured && measured, 'The PDF must pass through the instrumented printing window');
        assert.equal(result.report.paragraphLayout?.processed, 1);
        assert.equal(captured!.count, fixture.count, 'Print-width reflow must reproduce the dry-layout line count');
        assert.equal(captured!.text, fixture.text, 'Every source character must remain in the exported paragraph');
        assert.equal(captured!.widthsFit, true, 'Every generated line must fit the final paper width');
        assert.equal(captured!.linkResolved, true, 'The inline link must retain its resolved PDF destination');
        assert.equal(captured!.qed, mode === 'proof' ? 1 : 0, 'An optimized proof must have exactly one final QED');
        assert.ok(result.report.validInternalLinks > 0, 'Inline reference links must remain usable in the finished PDF');
        const groups = new Map<number, number>();
        let previousPage = -1;
        for (let index = 0; index < captured!.count; index++) {
            const position = measured!.positions['kp-' + mode + '-line-' + index];
            assert.ok(position, 'Missing PDF position for paragraph line ' + index);
            assert.ok(position.page >= previousPage, 'PDF lines must retain source order');
            previousPage = position.page;
            groups.set(position.page, (groups.get(position.page) ?? 0) + 1);
        }
        assert.equal(groups.size, 2, 'The optimized paragraph must genuinely span two printed pages');
        assert.equal([...groups.values()].reduce((total, count) => total + count, 0), captured!.count, 'No optimized line may disappear during page fragmentation');
        for (const count of groups.values()) assert.ok(count >= 2, 'Native paragraph widow/orphan protection must prevent a one-line fragment');
        if (mode === 'widow') assert.equal([...groups.keys()][0], 0);
        else assert.ok([...groups.keys()][0] >= 1, 'The one-line space must be left blank rather than stranding the first line');
        assert.deepEqual((await measurePdf(result.bytes)).positions, {}, 'Test and heading probes must be removed from the final PDF');
        assert.deepEqual(result.report.horizontalOverflow, []);
        writeFileSync('output/kp-pagination' + (mode === 'widow' ? '' : '-' + mode) + '.pdf', result.bytes);
        console.log('Actual PDF KP ' + mode + ' pagination: ' + [...groups.values()].join(' + ') + ' lines, complete text and inline reference preserved.');
    }
}
