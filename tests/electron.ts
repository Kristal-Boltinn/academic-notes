import { app, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { exportPdf } from '../src/export/pdf';
import { PDFDocument, PDFName } from 'pdf-lib';
import { setLanguage } from '../src/i18n';
import { MOTIFS, motifMask, appearanceValues } from '../src/rendering/custom-appearance';

// The plugin runs in Obsidian's renderer; the standalone Electron test invokes it in the main process.
(globalThis as typeof globalThis & { window: Window }).window = globalThis as typeof globalThis & Window;

// Run in a separate Electron process; never connects to the user's Obsidian instance.
app.setPath('userData', resolve('output/electron-profile'));
app.commandLine.appendSwitch('disable-gpu');

const base = readFileSync('styles.css', 'utf8');
const print = readFileSync('src/styles/document.css', 'utf8');
const extra = process.env.ACADEMIC_TEST_THEME ? readFileSync(process.env.ACADEMIC_TEST_THEME, 'utf8') : '';
const shell = `body{--text-normal:#292929;--text-muted:#666;--text-accent:#248051;--color-blue:#286b76;--color-purple:#71628c;--color-green:#62752e;--color-cyan:#42786b;--color-orange:#946b2f;font:17px/1.65 'Microsoft YaHei',sans-serif;margin:40px;background:#fff}.theme-dark{--text-normal:#ededed;--text-muted:#aaa;background:#171717;color:#ededed}h1,h2{font-family:inherit}.callout-title{display:flex}.callout-icon{display:none}*{transition:none!important;animation:none!important}`;
const box = (type: string, title: string, content = '<p>中文正文 · A mathematical statement, with <strong>emphasis</strong>.</p>') =>
  `<div class="callout" data-callout="${type}"><div class="callout-title"><div class="callout-icon">◆</div><div class="callout-title-inner">${/^(Proof|Remark)$/.test(title) ? '<span class="phb-type-label">' + title + '</span>' : title}</div></div><div class="callout-content">${content}</div></div>`;
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
        const inspect=()=>boxes.map(box=>{const s=getComputedStyle(box);return {plain:['proof','remark'].includes(box.dataset.callout),background:s.backgroundColor,borderWidth:s.borderTopWidth,border:color(s.borderTopColor),fill:color(s.backgroundColor),body:getComputedStyle(box.querySelector(':scope > .callout-content')).backgroundColor}});
        const before=inspect();document.body.style.setProperty('--background-primary','#ffdf88');const after=inspect();
        document.body.classList.add('phb-neutral-body');
        const neutral=boxes.map(box=>getComputedStyle(box).color===getComputedStyle(document.body).getPropertyValue('--text-normal').trim());
        const texts=boxes.map(box=>color(getComputedStyle(box).color));const expectedText=color(getComputedStyle(document.body).getPropertyValue('--text-normal'));
        const emphasis=boxes.flatMap(box=>[...box.querySelectorAll('strong,em')].map(el=>color(getComputedStyle(el).color)));
        const remark=color(getComputedStyle(document.querySelector('[data-callout="remark"] > .callout-title')).color);
        const expectedRemark=color('color-mix(in srgb,'+getComputedStyle(document.body).getPropertyValue('--phb-def')+' '+(mode==='light'?'98%':'80%')+', white)');
        return {before,after,texts,expectedText,emphasis,remark,expectedRemark};
      })(${JSON.stringify(mode)},${JSON.stringify(palette)})`);
      assert.deepEqual(result.after, result.before, `${mode}/${palette}: page tint must not change box fill`);
      for (const [index, item] of result.before.entries()) {
        const weight = mode === 'light' ? .06 : .08, surface = mode === 'light' ? [255, 255, 255] : [24, 24, 27];
        if (item.plain) {
          assert.equal(item.background, 'rgba(0, 0, 0, 0)', 'Proof/remark must have no colored background');
          assert.equal(item.borderWidth, '0px', 'Proof/remark must have no frame');
        } else for (let k = 0; k < 3; k++) assert.ok(Math.abs(item.fill[k] - Math.round(item.border[k] * weight + surface[k] * (1 - weight))) <= 1, `${mode}/${palette} box ${index}: same-color fill`);
        assert.equal(item.body, 'rgba(0, 0, 0, 0)', 'content must not paint a second background');
        assert.deepEqual(result.texts[index], result.expectedText, 'neutral body should work without postprocessor classes');
      }
      for(const color of result.emphasis) assert.deepEqual(color,result.expectedText,'emphasis must inherit the selected body color');
      assert.deepEqual(result.remark, result.expectedRemark, 'Remark must use a brighter tone of the selected palette, not a fixed color');
      cases++;
    }
    await wc.executeJavaScript(`document.body.className='theme-light an-active';document.body.dataset.anPalette='forest';new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    writeFileSync('screenshots/theorem.png', (await wc.capturePage()).toPNG());
    const plainExamples = ['proof', 'pf', 'remark', 'rem', 'rmk'].map(type => box(type,
      ['proof', 'pf'].includes(type) ? 'Proof' : 'Remark', '<p>Take an open set U. Its inverse image under the composition is open.</p>')).join('') +
      box('proof', 'Proof · A list ending', '<ul><li>The first step.</li><li>The final step.</li></ul>') +
      box('proof', 'Proof · A displayed equation', '<div class="math-block">f(g(x)) = (f ∘ g)(x)</div>') +
      box('proof', 'Proof · Nested argument', '<p>First establish the following fact.</p>' + box('remark', 'Remark', '<p>A nested remark has no QED.</p>') + '<p>This completes the argument.</p>');
    for (const mode of ['light', 'dark']) for (const context of ['markdown-preview-view', 'markdown-source-view mod-cm6']) {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html('<main class="markdown-rendered ' + context + '">' + plainExamples + '</main>')));
      const checks = await wc.executeJavaScript(`((mode)=>{
        document.body.className='theme-'+mode+' an-active phb-no-motif phb-neutral-body';
        return [...document.querySelectorAll('.callout')].map(box=>{
          const title=box.querySelector(':scope > .callout-title'),content=box.querySelector(':scope > .callout-content'),s=getComputedStyle(box),t=getComputedStyle(title);
          const qed=[getComputedStyle(content,'::after').content,...[...content.children].map(p=>getComputedStyle(p,'::after').content)].filter(s=>s.includes('□')).length;
          const foldedBefore=t.display;box.classList.add('is-collapsed');const collapsed=getComputedStyle(content).display;box.classList.remove('is-collapsed');
          const paragraph=content.firstElementChild,inline=paragraph?.tagName==='P';
          const titleRect=title.getBoundingClientRect(),contentRect=paragraph?.getBoundingClientRect();
          return {type:box.dataset.callout,border:s.borderTopWidth,background:s.backgroundColor,shadow:s.boxShadow,padding:s.padding,radius:s.borderTopLeftRadius,titlePadding:t.padding,titleBackground:t.backgroundColor,icon:getComputedStyle(title.querySelector('.callout-icon')).display,inline,aligned:!inline||Math.abs(titleRect.top-contentRect.top)<1,qed,collapsed,foldedBefore};
        });
      })(${JSON.stringify(mode)})`);
      for (const check of checks) {
        assert.equal(check.border, '0px'); assert.equal(check.background, 'rgba(0, 0, 0, 0)');
        assert.equal(check.shadow, 'none'); assert.equal(check.titleBackground, 'rgba(0, 0, 0, 0)');
        assert.equal(check.padding, '0px'); assert.equal(check.radius, '0px'); assert.equal(check.titlePadding, '0px');
        assert.equal(check.icon, 'none'); assert.equal(check.aligned, true, 'A paragraph proof/remark must start beside its inline title');
        assert.equal(check.collapsed, 'none');
        assert.equal(check.qed, ['proof', 'pf'].includes(check.type) ? 1 : 0, `${mode}/${context}: QED must appear once, only for a proof`);
      }
    }
    for (const [type, title, text] of [
      ['proof', 'Proof', '<p>Let U be open. Since f and g are continuous, both f⁻¹(U) and g⁻¹(f⁻¹(U)) are open.</p><p>Thus the composition f ∘ g is continuous.</p>'],
      ['remark', 'Remark', '<p>The argument only uses inverse images of open sets. It applies to arbitrary topological spaces.</p>']
    ]) {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html('<main class="markdown-preview-view markdown-rendered">' + box(type, title, text) + '</main>')));
      const bounds = await wc.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const r=document.querySelector('main').getBoundingClientRect();resolve({x:0,y:0,width:1000,height:Math.ceil(r.bottom+40)})})))`);
      writeFileSync('screenshots/' + type + '.png', (await wc.capturePage(bounds)).toPNG());
    }
    const customConfig = JSON.stringify({ thm: { light: '#eebbee', dark: '#325577', motif: 'compass', motifLight: '#993366', motifDark: '#eecc66' }, axiom: { light: '#445566', dark: '#445566', motif: 'none' }, proof: { light: '#993366', dark: '#993366' }, remark: { light: '#993366', dark: '#993366' } });
    for (const dark of [false, true]) {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html('<main class="markdown-rendered markdown-preview-view">' + box('thm', 'Theorem', '<p>Custom appearance</p>' + box('def', 'Definition')) + box('axiom', 'Axiom') + box('proof', 'Proof') + box('remark', 'Remark') + '</main>')));
      const values = appearanceValues(customConfig, dark);
      const result = await wc.executeJavaScript(`(()=>{document.body.classList.toggle('theme-dark',${dark});document.body.classList.toggle('theme-light',${!dark});Object.entries(${JSON.stringify(values)}).forEach(([k,v])=>document.body.style.setProperty(k,v));const thm=document.querySelector('[data-callout="thm"]'),title=thm.querySelector('.callout-title'),motif=getComputedStyle(thm,'::after');return {accent:getComputedStyle(thm).borderTopColor,title:getComputedStyle(title).color,motif:motif.backgroundColor,mask:motif.maskImage,child:getComputedStyle(thm.querySelector('[data-callout="def"]')).borderTopColor,axiom:getComputedStyle(document.querySelector('[data-callout="axiom"]')).borderTopColor,none:getComputedStyle(document.querySelector('[data-callout="axiom"]'),'::after').display,plain:[...document.querySelectorAll('[data-callout="proof"],[data-callout="remark"]')].map(el=>({color:getComputedStyle(el.querySelector('.callout-title')).color,border:getComputedStyle(el).borderTopWidth,motif:getComputedStyle(el,'::after').display}))}})()`);
      assert.equal(result.accent, dark ? 'rgb(50, 85, 119)' : 'rgb(238, 187, 238)');
      assert.equal(result.title, dark ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)');
      assert.equal(result.motif, dark ? 'rgb(238, 204, 102)' : 'rgb(153, 51, 102)');
      assert.ok(result.mask.includes('data:image/svg+xml')); assert.notEqual(result.child, result.accent);
      assert.equal(result.axiom, 'rgb(68, 85, 102)'); assert.equal(result.none, 'none');
      for (const plain of result.plain) assert.deepEqual(plain, { color: 'rgb(153, 51, 102)', border: '0px', motif: 'none' });
      const knobs = await wc.executeJavaScript(`(()=>{for(const [k,v] of Object.entries({'--phb-radius':'0px','--phb-border-width':'2px','--an-motif-size':'36px','--an-motif-opacity':'.6'}))document.body.style.setProperty(k,v);const el=document.querySelector('[data-callout="thm"]'),s=getComputedStyle(el),m=getComputedStyle(el,'::after');return {radius:s.borderTopLeftRadius,width:s.borderTopWidth,size:m.width,opacity:m.opacity}})()`);
      assert.deepEqual(knobs, { radius: '0px', width: '2px', size: '36px', opacity: '0.6' });
    }
    const gallery = '<main><h1>Corner motifs</h1><p>Original vector drawings · large preview and actual 27 px size</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">' + Object.keys(MOTIFS).map(id => `<div style="border:1px solid #ccd6d6;border-radius:8px;padding:18px;text-align:center"><div style="display:flex;align-items:center;justify-content:center;gap:18px"><span class="an-motif-sample" style="width:68px;height:68px;--an-preview-mask:${motifMask(id).replace(/"/g, '&quot;')}"></span><span class="an-motif-sample" style="width:27px;height:27px;--an-preview-mask:${motifMask(id).replace(/"/g, '&quot;')}"></span></div><p>${id}</p></div>`).join('') + '</div></main>';
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html(gallery)));
    await wc.executeJavaScript('document.fonts.ready');
    const galleryBounds = await wc.executeJavaScript(`(()=>{const r=document.querySelector('main').getBoundingClientRect();return {x:0,y:0,width:1000,height:Math.ceil(r.bottom+40)}})()`);
    writeFileSync('screenshots/motifs.png', (await wc.capturePage(galleryBounds)).toPNG());
    const captionClient = buildSync({ stdin: { contents: "import Engine from './src/indexing/engine'; import {mediaRecord} from './src/rendering/adapters'; globalThis.captionEngine=Engine; globalThis.decorateMedia=mediaRecord;", resolveDir: process.cwd() }, alias: { obsidian: resolve('tests/obsidian-mock.ts') }, bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022' }).outputFiles[0].text;
    const captionSource = '> [!figure] Mixed captions\n> > [!subfig]\n> > ![[a.svg]]\n>\n> ^blank\n>\n> > [!subfigure] Subfigure\n> > ![[b.svg]]';
    const captionImage = `<p><img alt="Decorative curve" src="data:image/svg+xml;base64,${Buffer.from(readFileSync('examples/assets/curve-a.svg')).toString('base64')}"></p>`;
    let captionlessMarkup = '';
    for (const context of ['markdown-preview-view', 'markdown-source-view mod-cm6']) {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html('<main class="markdown-rendered ' + context + '">' + box('figure', 'Mixed captions', box('subfig', 'Subfig', captionImage) + box('subfigure', 'Subfigure', captionImage)) + '</main>')));
      await wc.executeJavaScript(`Object.defineProperty(Document.prototype,'win',{get(){return this.defaultView}});window.createSpan=()=>document.createElement('span');void 0;`);
      await wc.executeJavaScript(captionClient);
      const captions = await wc.executeJavaScript(`(()=>{const note=captionEngine.parse('figures.md',${JSON.stringify(captionSource)});const nodes=[...document.querySelectorAll('.callout')];function paint(){nodes.forEach((el,i)=>decorateMedia(el,note.media[i]));}function state(){const blank=nodes[1],title=blank.querySelector(':scope > .callout-title');return {label:blank.querySelector('.an-caption-label').textContent,display:getComputedStyle(title).display,height:title.getBoundingClientRect().height,content:getComputedStyle(blank.querySelector('.callout-content')).display,named:nodes[2].querySelector('.an-caption-text').textContent,letter:nodes[2].querySelector('.an-caption-label').textContent};}captionEngine.graph([note]);paint();const empty=state();captionEngine.graph([note,captionEngine.parse('other.md','[[figures#^blank]]')]);paint();const referenced=state();captionEngine.graph([note]);paint();const reset=state();nodes[1].classList.add('is-collapsible');const fold=state();document.body.classList.add('phb-export');const exported=state();nodes[1].classList.remove('is-collapsible');return {empty,referenced,reset,fold,exported,markup:document.querySelector('main').innerHTML}})()`);
      assert.deepEqual(captions.empty, { label: '', display: 'none', height: 0, content: 'block', named: 'Subfigure', letter: '(a)' });
      assert.equal(captions.referenced.label, '(a)'); assert.equal(captions.referenced.display, 'flex'); assert.equal(captions.referenced.letter, '(b)');
      assert.deepEqual(captions.reset, captions.empty);
      assert.equal(captions.fold.display, 'flex', 'Keep explicit folding controls usable');
      assert.equal(captions.exported.display, 'none', 'Print must not reserve an empty caption row');
      captionlessMarkup = captions.markup;
    }
    const figureMarkup = `<main class="markdown-preview-view markdown-rendered"><h1>Figures and references</h1><p>Compare <a class="an-ref" href="#figure">fig 1.1</a> and <a class="an-ref" href="#theorem">thm 1.1</a>.</p>` +
      `<div id="figure" class="callout an-media" data-callout="figure"><div class="callout-title"><div class="callout-title-inner"><span class="an-caption-label">Figure 1.1</span><span class="an-caption-text">Two curves</span></div></div><div class="callout-content an-figure-grid">` +
      ['a', 'b'].map((letter, i) => `<div class="an-subfigure-cell"><div class="callout an-media" data-callout="subfigure"><div class="callout-title"><div class="callout-title-inner">(${letter}) State ${i + 1}</div></div><div class="callout-content"><img alt="Curve ${letter}" src="data:image/svg+xml;base64,${Buffer.from(readFileSync('examples/assets/curve-' + letter + '.svg')).toString('base64')}"></div></div></div>`).join('') +
      '</div></div>' + box('thm', 'Theorem 1.1 · Reference target').replace('<div class="callout"', '<div id="theorem" class="callout"') + '</main>';
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html(figureMarkup)));
    await wc.executeJavaScript(`Promise.all([...document.images].map(img=>img.decode())).then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))`);
    const figureLayout = await wc.executeJavaScript(`(() => {
      const figure=document.getElementById('figure'),content=figure.querySelector(':scope > .callout-content');
      return {grid:getComputedStyle(content).display,captionOrder:getComputedStyle(figure.querySelector(':scope > .callout-title')).order,cells:content.querySelectorAll(':scope > .an-subfigure-cell').length};
    })()`);
    assert.deepEqual(figureLayout, { grid: 'flex', captionOrder: '2', cells: 2 }, 'Figure layout must survive theme overrides');
    const layoutClient = buildSync({ stdin: { contents: "import {applyFigureLayout} from './src/rendering/figure-layout'; globalThis.applyFigureLayout=applyFigureLayout;", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022' }).outputFiles[0].text;
    const groupMarkup = (count: number) => `<main class="markdown-preview-view markdown-rendered"><div class="callout an-media" data-callout="figure"><div class="callout-title"><div class="callout-title-inner">Figure · Aligned image areas</div></div><div class="callout-content an-figure-grid">` +
      Array.from({ length: count }, (_, i) => `<div class="an-subfigure-cell"><div class="callout an-media" data-callout="subfigure"><div class="callout-title"><div class="callout-title-inner">(${String.fromCharCode(97 + i)}) Image ${i + 1}</div></div><div class="callout-content"><p><span class="image-embed" style="width:300px"><img width="300" src="data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${i % 2 ? 120 : 320}" height="${i % 2 ? 240 : 120}"><rect width="100%" height="100%" fill="${i % 2 ? '#71628c' : '#286b76'}"/><circle cx="60" cy="60" r="40" fill="#fff"/></svg>`).toString('base64')}"></span></p></div></div></div>`).join('') + '</div></div></main>';
    for (const count of [2, 3, 4, 6]) {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html(groupMarkup(count), 'html{font-size:16px}')));
      await wc.executeJavaScript(layoutClient);
      for (const width of [300, 500, 700, 900]) {
        const layout = await wc.executeJavaScript(`(async()=>{const box=document.querySelector('[data-callout="figure"]');box.style.width='${width}px';box.style.maxWidth='none';applyFigureLayout(box,${count},{columns:'auto',height:180});await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const cells=[...box.querySelectorAll('.an-subfigure-cell')];return {rows:cells.map(c=>Math.round(c.getBoundingClientRect().top)),heights:[...box.querySelectorAll('img')].map(i=>i.getBoundingClientRect().height),fit:[...box.querySelectorAll('img')].map(i=>getComputedStyle(i).objectFit),overflow:cells.some(c=>c.scrollWidth>c.clientWidth+1)}})()`);
        const columns = width < 416 ? 1 : count === 4 ? (width >= 832 ? 4 : 2) : count === 2 ? 2 : (width >= 624 ? 3 : 2);
        const expected = Array.from({ length: Math.ceil(count / columns) }, (_, i) => Math.min(columns, count - i * columns));
        const rows = [...new Set(layout.rows)].map(y => layout.rows.filter((v: number) => v === y).length);
        assert.deepEqual(rows, expected, `Balanced ${count}-image group at ${width}px`);
        assert.ok(layout.heights.every((h: number) => h > 0 && h <= 180 && Math.abs(h - layout.heights[0]) < 1));
        assert.ok(layout.fit.every((fit: string) => fit === 'contain')); assert.equal(layout.overflow, false);
        if (count === 4 && (width === 700 || width === 900)) {
          const bounds = await wc.executeJavaScript(`(()=>{const r=document.querySelector('main').getBoundingClientRect();return {x:0,y:0,width:1000,height:Math.ceil(r.bottom+40)}})()`);
          writeFileSync('screenshots/subfigures-' + (width === 900 ? 'wide' : 'compact') + '.png', (await wc.capturePage(bounds)).toPNG());
        }
      }
      // Explicit two-column cap and removal of a previously selected height.
      const reset = await wc.executeJavaScript(`(()=>{const box=document.querySelector('[data-callout="figure"]');applyFigureLayout(box,${count},{columns:2});return {height:box.style.getPropertyValue('--an-subfigure-height'),uniform:box.classList.contains('an-uniform-height'),two:box.classList.contains('an-columns-2')}})()`);
      assert.deepEqual(reset, { height: '', uniform: false, two: true });
    }
    const tableMarkup = '<div class="callout an-media an-table" data-callout="table"><div class="callout-title"><div class="callout-title-inner">Table 1.1 · Parameters</div></div><div class="callout-content"><table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody><tr><td>a</td><td>1</td></tr><tr><td>b</td><td>2</td></tr></tbody></table></div></div>';
    // Exercise actual theme selectors used by editable tables, including hover.
    for (const mode of ['light', 'dark']) for (const context of ['markdown-preview-view', 'markdown-source-view mod-cm6']) {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html('<main class="markdown-rendered ' + context + '"><div class="cm-table-widget">' + tableMarkup + '</div></main>')));
      const tableChecks = await wc.executeJavaScript(`((mode)=>{document.body.className='theme-'+mode;const table=document.querySelector('table');return {collapse:getComputedStyle(table).borderCollapse,top:getComputedStyle(table).borderTopStyle,bottom:getComputedStyle(table).borderBottomStyle,header:getComputedStyle(table.tHead).borderBottomStyle,cells:[...table.querySelectorAll('td,th')].map(el=>({border:getComputedStyle(el).borderWidth,background:getComputedStyle(el).backgroundColor}))}})(${JSON.stringify(mode)})`);
      assert.equal(tableChecks.collapse, 'collapse'); assert.equal(tableChecks.top, 'solid'); assert.equal(tableChecks.bottom, 'solid'); assert.equal(tableChecks.header, 'solid');
      for (const cell of tableChecks.cells) { assert.equal(cell.border, '0px'); assert.equal(cell.background, 'rgba(0, 0, 0, 0)'); }
      const point = await wc.executeJavaScript(`(()=>{const r=document.querySelector('tbody td').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
      wc.sendInputEvent({ type: 'mouseMove', ...point });
      const hover = await wc.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>{const el=document.querySelector('tbody td'),s=getComputedStyle(el);resolve({active:el.matches(':hover'),shadow:s.boxShadow,background:s.backgroundColor})}))`);
      assert.equal(hover.active, true);
      assert.equal(hover.shadow, 'none', 'Table hover must not restore decorative cell borders');
      assert.equal(hover.background, 'rgba(0, 0, 0, 0)');
    }
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html(figureMarkup)));
    await wc.executeJavaScript(`Promise.all([...document.images].map(img=>img.decode()))`);
    writeFileSync('screenshots/figures.png', (await wc.capturePage()).toPNG());
    writeFileSync('screenshots/references.png', (await wc.capturePage({ x: 0, y: 0, width: 950, height: 230 })).toPNG());
    // Run the same document module that is bundled into the plugin, in an isolated DOM.
    const client = buildSync({ stdin: { contents: "import core from './src/export/document'; globalThis.AcademicTestDoc=core;", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022' }).outputFiles[0].text;
    const paragraphs = '<p>A synthetic paragraph used to exercise real page boundaries and repeated printing.</p>'.repeat(25);
    const longProof = box('proof', 'A longer argument', '<p>We now check an argument that continues across page boundaries.</p>' +
      Array.from({ length: 32 }, (_, i) => `<p>Step ${i + 1}. Choose an open neighborhood and apply continuity to each inverse image. This synthetic argument exercises paragraph flow across printed pages without repeating the proof title.</p>`).join('') +
      '<p>END OF LONG PROOF. The last step establishes the required continuity.</p>');
    const book = `<main id="phb-document" class="markdown-preview-view markdown-rendered"><section class="phb-chapter" data-path="a.md" data-title="Chapter A"><h1>Chapter A</h1><h2>Compactness</h2>${content}${longProof}<h6>1.2.3 Ordinary H6 heading</h6>${paragraphs}<a data-href="b.md#Destination" href="b.md#Destination">Go to chapter B</a></section><section class="phb-chapter" data-path="b.md" data-title="Chapter B"><h1>Chapter B</h1><h2>Destination</h2>${paragraphs}</section></main>`;
    const fourFigures = groupMarkup(4).replace(/^<main[^>]*>|<\/main>$/g, '').replace('class="callout an-media"', 'class="callout an-media an-columns-4 an-uniform-height" style="--an-subfigure-height:140px;--an-max-image-ratio:2.6666666666666665"');
    const illustratedBook = book.replace('<h2>Compactness</h2>', '<h2>Compactness</h2><div data-phb-block="thm-a">Theorem A target</div><a class="internal-link" data-href="b.md#^thm-b">Forward theorem reference</a>').replace('<h2>Destination</h2>', '<h2>Destination</h2><div data-phb-block="thm-b">Theorem B target</div><a class="internal-link" data-href="a.md#^thm-a">Backward theorem reference</a>' + figureMarkup.replace(/^<main[^>]*>|<\/main>$/g, '') + fourFigures + tableMarkup + captionlessMarkup);
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html(illustratedBook, print)));
    // Minimal Obsidian DOM helpers for the snapshot builder; the real print
    // window below has no helpers, Node access, or application runtime.
    await wc.executeJavaScript(`Object.defineProperty(Document.prototype,'win',{get(){return this.defaultView}}); window.createEl=tag=>document.createElement(tag); window.createDiv=()=>document.createElement('div'); window.createSpan=()=>document.createElement('span'); void 0;`);
    await wc.executeJavaScript(client);
    const snapshot = await wc.executeJavaScript(`(() => {
      document.body.classList.add('phb-export');
      Object.entries(${JSON.stringify(appearanceValues(customConfig, false))}).forEach(([k,v])=>document.body.style.setProperty(k,v));
      if(getComputedStyle(document.querySelector('.an-figure-grid')).display!=='flex')throw new Error('Export shell disabled the subfigure grid');
      const heading=document.querySelector('h2');
      const emphasis=document.createElement('em');emphasis.textContent=' <formula>';heading.appendChild(emphasis);
      const glyph=document.createElementNS('http://www.w3.org/2000/svg','svg');
      glyph.setAttribute('width','1');glyph.setAttribute('height','1');
      const path=document.createElementNS(glyph.namespaceURI,'path');path.id='toc-test-glyph';glyph.appendChild(path);
      const use=document.createElementNS(glyph.namespaceURI,'use');use.setAttribute('href','#toc-test-glyph');glyph.appendChild(use);heading.appendChild(glyph);
      const meta=AcademicTestDoc.prepare(document.getElementById('phb-document'),{book:true,title:'Sample Book',tocDepth:6,legacyCaptions:true});
      for(const link of document.querySelectorAll('a[data-href*="#^thm-"]')){const target=document.getElementById(link.getAttribute('href').slice(1));if(!target||target.closest('.phb-chapter')===link.closest('.phb-chapter'))throw new Error('Cross-chapter theorem reference lost its target');}
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
    let requests = 0;
    const server = createServer((_request, response) => {
      requests++;
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const networkUrl = `http://127.0.0.1:${address.port}/asset.svg`;
    const localUrl = pathToFileURL(resolve('examples/assets/curve-a.svg')).href;
    const printWindows: BrowserWindow[] = [];
    let guardedLoads = 0;
    class GuardedPrintWindow extends BrowserWindow {
      constructor(options: Electron.BrowserWindowConstructorOptions) {
        assert.equal(options.webPreferences?.sandbox, true);
        assert.equal(options.webPreferences?.nodeIntegration, false);
        assert.equal(options.webPreferences?.contextIsolation, true);
        assert.ok(!options.webPreferences?.partition?.startsWith('persist:'));
        super(options);
        printWindows.push(this);
      }
      override async loadURL(url: string, options?: Electron.LoadURLOptions) {
        assert.ok(url.length < 2048, 'The full snapshot must never become a data URL');
        await super.loadURL(url, options);
        if (!url.startsWith('blob:')) return;
        guardedLoads++;
        const protection = await this.webContents.executeJavaScript(`(async () => {
          const urls=${JSON.stringify([localUrl, networkUrl])};
          const images=await Promise.all(urls.map(async url=>{const img=new Image();img.src=url;try{await img.decode();return true}catch{return false}}));
          let network=false;try{await fetch(urls[1]);network=true}catch{}
          document.getElementById('security-probe')?.remove();
          return {node:typeof process,require:typeof require,helper:typeof createEl,scripts:document.body.dataset.executed||'',images,network};
        })()`);
        console.log('Print isolation checks:', JSON.stringify(protection));
        assert.deepEqual(protection, { node: 'undefined', require: 'undefined', helper: 'undefined', scripts: '', images: [false, false], network: false });
      }
    }
    let result: Awaited<ReturnType<typeof exportPdf>>;
    try {
      // Remove the snapshot's own CSP to verify that the exporter enforces its
      // policy even if a future snapshot generator forgets its meta tag.
      const guardedSnapshot = snapshot.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
        .replace('</body>', '<script>document.body.dataset.executed="script"</script><img hidden id="security-probe" src="data:image/png;base64,broken" onerror="document.body.dataset.executed=\'event\'"></body>');
      result = await exportPdf(guardedSnapshot + '<!--' + 'large snapshot 中文 '.repeat(400000) + '-->', console.log, undefined, GuardedPrintWindow);
      const controller = new AbortController();
      await assert.rejects(exportPdf(snapshot, () => controller.abort(), controller.signal, GuardedPrintWindow), /Export cancelled/);
      const brokenImage = snapshot.replace('</body>', '<img src="data:image/png;base64,broken" alt="invalid fixture"></body>');
      await assert.rejects(exportPdf(brokenImage, () => {}, undefined, GuardedPrintWindow), /Unable to load image/);
      setLanguage('zh-CN');
      await assert.rejects(exportPdf(brokenImage, () => {}, undefined, GuardedPrintWindow), /图片无法加载/);
      setLanguage('en');
      assert.equal(guardedLoads, 3);
      assert.equal(requests, 0, 'The working local HTTP server must receive no requests');
      assert.ok(printWindows.every(window => window.isDestroyed()), 'Success, cancellation and failure must close their windows');
      console.log('Memory transport, enforced CSP, blocked Node/file/network access, cancellation and failure cleanup passed.');
    } finally {
      printWindows.forEach(window => { if (!window.isDestroyed()) window.destroy(); });
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
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
