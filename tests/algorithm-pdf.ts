import assert from 'node:assert/strict';
import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import { writeFileSync } from 'node:fs';
import { exportPdf } from '../src/export/pdf';
import { measurePdf, PROBE } from '../src/export/pdf-postprocess';

export async function runAlgorithmPdf(markup: string, html: (body: string, css?: string) => string, printCss: string) {
    let measurement: Awaited<ReturnType<typeof measurePdf>> | undefined;
    class ProbedWindow extends BrowserWindow {
        constructor(options: BrowserWindowConstructorOptions) {
            super(options); const wc=this.webContents, nativePrint=wc.printToPDF.bind(wc);
            wc.printToPDF=async options=>{
                await wc.executeJavaScript(`(()=>{
                    document.querySelectorAll('.an-algorithm').forEach((box,index)=>{
                        box.querySelectorAll('.an-algorithm-line').forEach((row,line)=>{
                            for(const end of ['top','bottom']) {
                                row.style.position='relative';const a=document.createElement('a');a.className='phb-probe';a.href=${JSON.stringify(PROBE)}+'algorithm-'+index+'-'+line+'-'+end;a.textContent='.';
                                a.style.cssText='position:absolute!important;display:block!important;left:0!important;top:'+ (end==='top'?'0':'auto') +'!important;bottom:'+ (end==='bottom'?'0':'auto') +'!important;width:1px!important;height:1px!important;font:1px/1px Arial!important;margin:0!important;padding:0!important';row.appendChild(a);
                            }
                        });
                    });
                })()`);
                const bytes=await nativePrint(options); measurement=await measurePdf(bytes); return bytes;
            };
        }
    }
    const result=await exportPdf(html(markup,printCss),()=>{},undefined,ProbedWindow,{kp:true});
    assert.ok(measurement&&result.report.pages>=3,'Long algorithm must paginate');
    assert.ok(result.report.validInternalLinks>=1,'Cross-file algorithm reference must remain an internal PDF destination');
    const shortPages=new Set<number>(), longPages=new Set<number>();
    for(const [key,pos] of Object.entries(measurement!.positions)) {
        if(!key.startsWith('algorithm-')) continue;
        const parts=key.split('-'); (parts[1]==='0'?shortPages:longPages).add(pos.page);
        if(parts[3]==='top') assert.equal(pos.page,measurement!.positions[key.replace(/top$/,'bottom')]?.page,'An algorithm line must not be cut across PDF pages');
    }
    assert.equal(shortPages.size,1,'A short algorithm stays on one page'); assert.ok(longPages.size>1,'A long algorithm splits between complete rows');
    assert.equal(Object.keys(measurement!.positions).filter(key=>/^algorithm-1-\d+-top$/.test(key)).length,100,'All long algorithm rows reach the PDF');
    writeFileSync('output/algorithms.pdf',result.bytes);
    console.log('Actual algorithm PDF: short block kept intact, 100 long rows split between complete lines, cross-file link preserved.');
}
