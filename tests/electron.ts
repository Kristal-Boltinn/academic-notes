import { app, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { exportPdf } from '../src/export/pdf';
import { PDFDocument, PDFName } from 'pdf-lib';

// Run in a separate Electron process; never connects to the user's Obsidian instance.
app.setPath('userData', resolve('output/electron-profile'));
app.commandLine.appendSwitch('disable-gpu');

const base = readFileSync('styles.css', 'utf8');
const print = readFileSync('src/styles/document.css', 'utf8');
const extra = process.env.ACADEMIC_TEST_THEME ? readFileSync(process.env.ACADEMIC_TEST_THEME, 'utf8') : '';
const shell = `body{--text-normal:#292929;--text-muted:#666;--text-accent:#248051;--color-blue:#286b76;--color-purple:#71628c;--color-green:#62752e;--color-cyan:#42786b;--color-orange:#946b2f;font:17px/1.65 'Microsoft YaHei',sans-serif;margin:40px;background:#fff}.theme-dark{--text-normal:#ededed;--text-muted:#aaa;background:#171717;color:#ededed}h1,h2{font-family:inherit}.callout-title{display:flex}.callout-icon{display:none}*{transition:none!important;animation:none!important}`;
const box = (type: string, title: string, content = '<p>中文正文 · A mathematical statement, with <strong>emphasis</strong>.</p>') =>
  `<div class="callout" data-callout="${type}"><div class="callout-title"><div class="callout-title-inner">${title}</div></div><div class="callout-content">${content}</div></div>`;
const content = box('def', 'Definition 1.1 · Compactness') + box('thm', 'Theorem 1.1 · Finite spaces',
  '<p>A finite space is compact.</p>' + box('lem', 'Lemma 1.1 · Nested', '<p>The nested box has its own purple tint.</p>')) +
  box('prop', 'Proposition 1.1') + box('cor', 'Corollary 1.1') + box('example', 'Example 1.1') + box('proof', 'Proof') + box('remark', 'Remark');
const html = (body: string, css = '') => `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none'"><style>${shell}\n${extra}\n${base}\n${css}</style></head><body class="theme-light an-active" data-an-palette="forest">${body}</body></html>`;

async function run() {
  mkdirSync('output', { recursive: true }); mkdirSync('screenshots', { recursive: true });
  const win = new BrowserWindow({ show: false, width: 1000, height: 1300, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false } });
  try {
    const wc = win.webContents;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html('<main class="markdown-preview-view markdown-rendered">' + content + '</main>')));
    const palettes = { light: ['forest', 'sakura', 'mint', 'sky', 'mauve', 'golden', 'cherry', 'prussian', 'theme'], dark: ['radiation', 'vampire', 'abyss', 'theme'] };
    let cases = 0;
    for (const [mode, names] of Object.entries(palettes)) for (const palette of names) {
      const result = await wc.executeJavaScript(`((mode,palette)=>{
        document.body.className='theme-'+mode+' an-active';document.body.dataset.anPalette=palette;
        const boxes=[...document.querySelectorAll('.callout')];
        const color=v=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d');c.fillStyle=v;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3)};
        const inspect=()=>boxes.map(box=>{const s=getComputedStyle(box);return {border:color(s.borderTopColor),fill:color(s.backgroundColor),body:getComputedStyle(box.querySelector(':scope > .callout-content')).backgroundColor}});
        const before=inspect();document.body.style.setProperty('--background-primary','#ffdf88');const after=inspect();
        document.body.classList.add('phb-neutral-body');
        const neutral=boxes.map(box=>getComputedStyle(box).color===getComputedStyle(document.body).getPropertyValue('--text-normal').trim());
        const texts=boxes.map(box=>color(getComputedStyle(box).color));const expectedText=color(getComputedStyle(document.body).getPropertyValue('--text-normal'));
        const emphasis=boxes.flatMap(box=>[...box.querySelectorAll('strong,em')].map(el=>color(getComputedStyle(el).color)));return {before,after,texts,expectedText,emphasis};
      })(${JSON.stringify(mode)},${JSON.stringify(palette)})`);
      assert.deepEqual(result.after, result.before, `${mode}/${palette}: page tint must not change box fill`);
      for (const [index, item] of result.before.entries()) {
        const weight = mode === 'light' ? .06 : .08, surface = mode === 'light' ? [255, 255, 255] : [24, 24, 27];
        for (let k = 0; k < 3; k++) assert.ok(Math.abs(item.fill[k] - Math.round(item.border[k] * weight + surface[k] * (1 - weight))) <= 1, `${mode}/${palette} box ${index}: same-color fill`);
        assert.equal(item.body, 'rgba(0, 0, 0, 0)', 'content must not paint a second background');
        assert.deepEqual(result.texts[index], result.expectedText, 'neutral body should work without postprocessor classes');
      }
      for(const color of result.emphasis) assert.deepEqual(color,result.expectedText,'emphasis must inherit the selected body color');
      cases++;
    }
    await wc.executeJavaScript(`document.body.className='theme-light an-active';document.body.dataset.anPalette='forest';new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    writeFileSync('screenshots/theorem.png', (await wc.capturePage()).toPNG());
    const figureMarkup = `<main class="markdown-preview-view markdown-rendered"><h1>Figures and references</h1><p>Compare <a class="an-ref" href="#figure">fig 1.1</a> and <a class="an-ref" href="#theorem">thm 1.1</a>.</p>` +
      `<div id="figure" class="callout an-media" data-callout="figure"><div class="callout-title"><div class="callout-title-inner"><span class="an-caption-label">Figure 1.1</span><span class="an-caption-text">Two curves</span></div></div><div class="callout-content an-figure-grid">` +
      ['a', 'b'].map((letter, i) => `<div class="an-subfigure-cell"><div class="callout an-media" data-callout="subfigure"><div class="callout-title"><div class="callout-title-inner">(${letter}) State ${i + 1}</div></div><div class="callout-content"><img alt="Curve ${letter}" src="data:image/svg+xml;base64,${Buffer.from(readFileSync('examples/assets/curve-' + letter + '.svg')).toString('base64')}"></div></div></div>`).join('') +
      '</div></div>' + box('thm', 'Theorem 1.1 · Reference target') + '</main>';
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html(figureMarkup)));
    await wc.executeJavaScript(`Promise.all([...document.images].map(img=>img.decode())).then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))`);
    writeFileSync('screenshots/figures.png', (await wc.capturePage()).toPNG());
    writeFileSync('screenshots/references.png', (await wc.capturePage({ x: 0, y: 0, width: 950, height: 230 })).toPNG());
    // Run the same document module that is bundled into the plugin, in an isolated DOM.
    const client = buildSync({ stdin: { contents: "import core from './src/export/document'; globalThis.AcademicTestDoc=core;", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022' }).outputFiles[0].text;
    const paragraphs = '<p>A synthetic paragraph used to exercise real page boundaries and repeated printing.</p>'.repeat(25);
    const book = `<main id="phb-document" class="markdown-preview-view markdown-rendered"><section class="phb-chapter" data-path="a.md" data-title="Chapter A"><h1>Chapter A</h1><h2>Compactness</h2>${content}<h6>1.2.3 Ordinary H6 heading</h6>${paragraphs}<a data-href="b.md#Destination" href="b.md#Destination">Go to chapter B</a></section><section class="phb-chapter" data-path="b.md" data-title="Chapter B"><h1>Chapter B</h1><h2>Destination</h2>${paragraphs}</section></main>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html(book, print)));
    await wc.executeJavaScript(client);
    const snapshot = await wc.executeJavaScript(`(() => {
      document.body.classList.add('phb-export');
      const heading=document.querySelector('h2');
      const emphasis=document.createElement('em');emphasis.textContent=' <formula>';heading.appendChild(emphasis);
      const glyph=document.createElementNS('http://www.w3.org/2000/svg','svg');
      const path=document.createElementNS(glyph.namespaceURI,'path');path.id='toc-test-glyph';glyph.appendChild(path);
      const use=document.createElementNS(glyph.namespaceURI,'use');use.setAttribute('href','#toc-test-glyph');glyph.appendChild(use);heading.appendChild(glyph);
      const meta=AcademicTestDoc.prepare(document.getElementById('phb-document'),{book:true,title:'Sample Book',tocDepth:6,legacyCaptions:true});
      const toc=document.querySelector('.phb-toc');
      if(toc.querySelector('em')?.textContent!==' <formula>')throw new Error('TOC lost inline formatting');
      const copiedGlyph=toc.querySelector('svg path');
      if(!copiedGlyph||copiedGlyph.id==='toc-test-glyph'||toc.querySelector('svg use').getAttribute('href')!=='#'+copiedGlyph.id)throw new Error('TOC glyph IDs were not remapped');
      if(heading.querySelector('path').id!=='toc-test-glyph')throw new Error('TOC mutated source heading');
      if(document.querySelectorAll('h6').length!==1||document.querySelector('figcaption'))throw new Error('H6 was converted');
      const script=document.createElement('script');script.id='phb-meta';script.type='application/json';script.textContent=JSON.stringify(meta);document.body.appendChild(script);
      return '<!doctype html>'+document.documentElement.outerHTML;
    })()`);
    writeFileSync('output/book.phb.html', snapshot);
    await wc.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    writeFileSync('screenshots/book-export.png', (await wc.capturePage()).toPNG());
    const result = await exportPdf(snapshot + '<!--' + 'large snapshot 中文 '.repeat(400000) + '-->', console.log, undefined, BrowserWindow);
    writeFileSync('output/book.pdf', result.bytes); writeFileSync('output/book.report.json', JSON.stringify(result.report, null, 2));
    assert.ok(result.report.pages >= 3);
    assert.ok(result.report.validInternalLinks >= 5, 'TOC and cross-chapter links must be internal PDF links');
    assert.ok(result.report.entries.some(e => e.title.includes('Ordinary H6')));
    const pdf = await PDFDocument.load(result.bytes);
    assert.ok(pdf.catalog.get(PDFName.of('Outlines')));
    console.log(JSON.stringify({ paletteCases: cases, pdf: result.report }));
  } finally { win.destroy(); }
}

app.whenReady().then(run).then(() => app.exit(0), error => { console.error(error); app.exit(1); });
