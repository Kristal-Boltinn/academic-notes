import test from 'node:test';
import { algorithmBlocks, parseAlgorithm } from '../src/algorithms/model';
import './kp-solver';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Engine from '../src/indexing/engine';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { measurePdf, finishPdf, PROBE } from '../src/export/pdf-postprocess';
import AcademicNotes from '../src/main';
import { ENGLISH, setLanguage, t } from '../src/i18n';
import { AcademicSettings } from '../src/ui/settings-tab';
import { setTestLanguage, MockElement, Setting, Platform } from './obsidian-mock';
import { pdfAvailability } from '../src/export/pdf';
import { environmentTemplate } from '../src/ui/environment';
import { figureMetadata } from '../src/rendering/figure-layout';
import { appearanceValues, parseAppearance, titleInk, MOTIFS } from '../src/rendering/custom-appearance';
import { parseDiagram, diagramFence, diagramBlocks, resizeDiagram, removeNode, removeArrow, isCommutingTriangle, type DiagramData } from '../src/diagrams/model';
import { commutationArc } from '../src/diagrams/geometry';
import { mathSource } from '../src/diagrams/math';
import { normalizeFloatOptions } from '../src/export/floats';
import { DEFAULTS as PluginDefaults } from '../src/settings';
import { diagramDeletionRange } from '../src/ui/diagram-modal';
import { proseLines } from '../src/typography/prose';
import { EditorState } from '@codemirror/state';

test('visual prose indentation excludes Markdown structures and detects paragraph starts', () => {
  const source = ['---','title: Fiction','---','# Heading','','First paragraph','continuation','','- list','lazy continuation','','> [!proof]','> Proof body','> second line','','[[note|alias]] prose','','$$','x+y','$$','','```text','code','```','','Setext','---','','^block-id','![image](example.svg)'].join('\n');
  const state = EditorState.create({doc: source});
  assert.deepEqual(proseLines(state).map(line => [state.doc.lineAt(line.from).text,line.start]), [['First paragraph',true],['continuation',false],['> Proof body',true],['> second line',false],['[[note|alias]] prose',true]]);
  assert.equal(PluginDefaults.paragraphIndent,false);
});

test('commutativity markers validate their paths, survive round trips and prune after edits', () => {
  const initial: DiagramData = { version: 1, grid: 3, nodes: [{id:'a',row:0,col:0,label:'A'}, {id:'b',row:0,col:2,label:'B'}, {id:'c',row:2,col:2,label:'C'}], arrows: [['a','b'],['b','c'],['a','c']].map(([from,to],i) => ({id:'e-'+i,from,to,label:'',style:'solid',side:'above'})), commutations: [{id:'c-1',from:'a',via:'b',to:'c'}] };
  const copy = () => parseDiagram(JSON.stringify(initial));
  assert.deepEqual(parseDiagram(diagramBlocks(diagramFence(initial))[0].source), initial);
  assert.equal(isCommutingTriangle(initial,'a','b','c'),true); assert.equal(isCommutingTriangle(initial,'c','b','a'),false);
  assert.throws(() => parseDiagram(JSON.stringify({...initial, arrows: initial.arrows.slice(1)})));
  assert.throws(() => parseDiagram(JSON.stringify({...initial, commutations: [...initial.commutations!, ...initial.commutations!]})));
  const collinear = copy(); collinear.nodes[2].row = 0; collinear.nodes[2].col = 1;
  assert.throws(() => parseDiagram(JSON.stringify(collinear)));
  for (const edit of [(d:DiagramData)=>removeArrow(d,'e-0'), (d:DiagramData)=>removeNode(d,'b'), (d:DiagramData)=>resizeDiagram(d,2)]) {
    const data = copy(); edit(data); assert.equal(data.commutations?.length,0); assert.doesNotThrow(()=>parseDiagram(JSON.stringify(data)));
  }
  assert.equal(parseDiagram('{"version":1,"grid":2,"nodes":[],"arrows":[]}').commutations,undefined);
  for (const mirrored of [false,true]) {
    const data = copy(); if(mirrored) data.nodes.forEach(n=>{n.col=2-n.col;});
    const arc = commutationArc(data,data.commutations![0]);
    assert.match(arc.path,/ A /); assert.ok(arc.radius>0 && arc.radius+8<arc.inradius,'Curve and arrowhead must remain inside the triangle');
    assert.ok(Number.isFinite(arc.x) && Number.isFinite(arc.y));
  }
});
test('diagram math accepts bare TeX and dollar or LaTeX delimiters', () => {
  for (const input of ['\\alpha', '$\\alpha$', '$$\\alpha$$', '\\(\\alpha\\)', '\\[\\alpha\\]']) assert.equal(mathSource(input),'\\alpha');
});

test('diagrams share figure counters and references without double-counting wrappers', () => {
  const data = parseDiagram('{"version":1,"grid":2,"caption":"Tensor diagram","nodes":[],"arrows":[]}');
  const fence = diagramFence(data);
  const note = Engine.parse('figures.md', '## Figures\n> [!figure] First\n> ![[a.png]]\n\n^first\n\n' + fence + '\n\n^diagram\n\n> [!figure] Third\n> ![[b.png]]\n\n^third');
  const refs = Engine.parse('references.md', '[[figures#^diagram]]');
  const graph = Engine.graph([note, refs]);
  assert.deepEqual(note.media.map(r => r.number), ['1.1', '1.2', '1.3']);
  assert.equal(note.blocks.get('diagram')?.title, 'Tensor diagram');
  assert.equal(Engine.refText(graph.resolve('figures#^diagram', 'references.md'), graph.settings), 'fig 1.2');
  Engine.graph([note], {}, undefined, new Map([['figures.md', { chapter: 3, mode: 'chapter' }]]));
  assert.equal(note.blocks.get('diagram')?.number, '3.2');
  const wrapped = Engine.parse('wrapped.md', '> [!figure] Wrapper\n' + diagramFence(data, '> ') + '\n\n^wrapper');
  Engine.graph([wrapped]); assert.equal(wrapped.media.length, 1); assert.equal(wrapped.media[0].diagram, undefined);
  for (const source of ['%%\n' + fence + '\n%%', '````markdown\n' + fence + '\n````', '```academic-diagram\ninvalid\n```']) assert.equal(Engine.parse('ignored.md', source).media.length, 0);
  assert.equal(parseDiagram(diagramBlocks(fence)[0].source).caption, 'Tensor diagram');
  assert.throws(() => parseDiagram(JSON.stringify({ ...data, caption: 'x'.repeat(201) })));
  let nestedSource = '> [!proof]\n' + diagramFence(data, '> ') + '\n>\n> The proof continues.';
  const plugin: any = new AcademicNotes(); plugin.scheduleIndex = () => {};
  const editor: any = { getValue: () => nestedSource, getCursor: () => ({ line: 2, ch: 0 }), replaceRange: (text: string, pos: {line:number;ch:number}) => {
    const offset = nestedSource.split('\n').slice(0, pos.line).reduce((n, line) => n + line.length + 1, 0) + pos.ch;
    nestedSource = nestedSource.slice(0, offset) + text + nestedSource.slice(offset);
  } };
  plugin.labelBlock(editor, { path: 'nested.md' });
  const labelled = Engine.parse('nested.md', nestedSource);
  assert.ok(labelled.media[0].id, 'Add-ID command must retain quote depth for a diagram inside a proof');
  assert.equal(labelled.blocks.get(labelled.media[0].id!)?.diagram, true);
});

test('diagram deletion removes its own anchor and preserves surrounding notes and parent anchors', () => {
  const data = parseDiagram('{"version":1,"grid":2,"nodes":[],"arrows":[]}');
  const source = 'Before\n\n' + diagramFence(data) + '\n\n^diagram\n\nAfter';
  const block = diagramBlocks(source)[0], range = diagramDeletionRange(source, block.from, block.to);
  const remaining = source.slice(0, range.from) + source.slice(range.to);
  assert.match(remaining, /^Before/); assert.match(remaining, /After$/); assert.ok(!remaining.includes('^diagram'));
  const quoted = '> [!figure] Parent\n' + diagramFence(data, '> ') + '\n\n^parent\n\nAfter';
  const child = diagramBlocks(quoted)[0], nested = diagramDeletionRange(quoted, child.from, child.to);
  assert.equal(nested.to, child.to); assert.ok((quoted.slice(0, nested.from) + quoted.slice(nested.to)).includes('^parent'));
});

test('PDF floating settings validate priorities and bound adjustment attempts', () => {
  assert.deepEqual(normalizeFloatOptions('invalid', Infinity), { mode: 'off', maxRounds: 6 });
  assert.deepEqual(normalizeFloatOptions('move-shrink', 999), { mode: 'move-shrink', maxRounds: 10 });
  assert.equal(normalizeFloatOptions('shrink', -2).maxRounds, 1);
  const plugin: any = { settings: { ...PluginDefaults }, saveSettings: async () => {} };
  const definitions = new AcademicSettings({} as any, plugin).getSettingDefinitions();
  const choice = definitions.find(d => d.name === 'Figure layout priority (experimental)')!;
  const options: Record<string,string> = {}; let callback: ((v: string) => Promise<void>) | undefined;
  const control: any = { addOptions(v: Record<string,string>) { Object.assign(options,v); return this; }, setValue() { return this; }, onChange(fn: typeof callback) { callback=fn; return this; } };
  choice.render({ addDropdown(fn: (v: unknown) => void) { fn(control); } } as any);
  assert.deepEqual(Object.keys(options), ['off','shrink-move','move-shrink','shrink','move']);
  void callback!('move-shrink'); assert.equal(plugin.settings.pdfFloatMode, 'move-shrink');
});

test('plugin lifecycle registers new commands, drops removed settings and restores appearance', async () => {
  const classes = new Set(['theme-light']);
  const inline = new Map<string, string>([['--an-color-thm', '#123456']]);
  const body = { dataset: {} as Record<string, string>,
    style: { getPropertyValue: (key: string) => inline.get(key) || '', getPropertyPriority: () => '', setProperty: (key: string, value: string) => inline.set(key, value), removeProperty: (key: string) => inline.delete(key) },
    getAttribute: () => null, removeAttribute: () => {},
    classList: { contains: (s: string) => classes.has(s), toggle: (s: string, value: boolean) => value ? classes.add(s) : classes.delete(s) } };
  const previous = { window: globalThis.window, document: globalThis.document, observer: globalThis.MutationObserver };
  globalThis.window = globalThis as any;
  globalThis.document = { body } as any;
  globalThis.MutationObserver = class { observe() {} disconnect() {} } as any;
  const app: any = { metadataCache: { on() {} }, vault: { on() {} }, workspace: { on() {}, onLayoutReady() {} } };
  const plugin: any = new AcademicNotes(app, { id: 'academic-notes', name: 'Academic Notes', version: '2.2.0' } as any);
  plugin.data = { paragraphIndent: true, legacy: true, legacyCaptions: true, followPhycat: true, pythonPath: 'unused', neutralBody: true, lightPalette: 'mint', customAppearance: JSON.stringify({ thm: { light: '#abcdef', dark: '#fedcba', motif: 'laurel' } }) };
  try {
    setTestLanguage('en');
    await plugin.onload();
    assert.equal(plugin.commands.length, 13);
    assert.equal(plugin.commands.find((c: any) => c.id === 'export-current-pdf').name, 'Export current note to PDF');
    assert.ok(!plugin.commands.some((c: any) => c.id === 'setup-pdf'));
    for (const key of ['legacy', 'legacyCaptions', 'followPhycat', 'pythonPath']) assert.ok(!(key in plugin.settings));
    assert.equal(plugin.settings.kpReading, false);
    assert.equal(plugin.settings.kpPdf, false);
    assert.equal(plugin.settings.paragraphIndent, true);
    assert.ok(classes.has('an-prose-indent'));
    assert.equal(body.dataset.anPalette, 'mint');
    assert.ok(classes.has('phb-neutral-body'));
    assert.equal(inline.get('--an-color-thm'), '#abcdef');
    classes.delete('theme-light'); classes.add('theme-dark'); plugin.applyAppearance();
    assert.equal(inline.get('--an-color-thm'), '#fedcba');
    plugin.onunload();
    assert.equal(inline.get('--an-color-thm'), '#123456');
    assert.equal(inline.has('--an-symbol-thm'), false);
    assert.ok(!classes.has('phb-neutral-body') && !classes.has('an-active') && !classes.has('an-prose-indent'));
  } finally { globalThis.window = previous.window; globalThis.document = previous.document; globalThis.MutationObserver = previous.observer; }
});

test('proof references parse without a space and preserve own-line intent and chapter numbering', () => {
  const a = Engine.parse('a.md', '> [!claim] A claim\n> Statement.\n\n^claim-a');
  const b = Engine.parse('b.md', '> [!proof][[a#^claim-a]]\n> Argument.\n\n> [!proof]\n> New-line argument.');
  const graph = Engine.graph([a, b], {}, undefined, new Map([['a.md', { chapter: 1, mode: 'chapter' }], ['b.md', { chapter: 2, mode: 'chapter' }]]));
  assert.equal(b.theorems.length, 2); assert.equal(b.theorems[0].title, '[[a#^claim-a]]');
  assert.equal(b.theorems[0].proofOwnLine, false); assert.equal(b.theorems[1].proofOwnLine, true);
  assert.equal(b.refs[0].target, a.theorems[0]); assert.equal(graph.resolve('a#^claim-a', 'b.md')?.number, '1.1');
  const plugin: any = new AcademicNotes(); plugin.settings = { ...Engine.DEFAULTS };
  assert.match(plugin.exportSource(b, graph), /> \[!proof\] \[\[a#\^claim-a\|clm 1\.1\]\]/);
});

test('diagram data round-trips safely, finds quoted blocks and prunes invalid endpoints on resize', () => {
  const data = parseDiagram(JSON.stringify({ version: 1, grid: 3, nodes: [{ id: 'a', row: 0, col: 0, label: 'M \\otimes_R N' }, { id: 'b', row: 2, col: 2, label: 'P' }], arrows: [{ id: 'f', from: 'a', to: 'b', label: '\\exists! f', style: 'dashed', side: 'above' }] }));
  const fence = diagramFence(data, '> '), note = 'Intro\n\n' + fence + '\n\nConclusion';
  const [block] = diagramBlocks(note); assert.equal(block.prefix, '> '); assert.equal(note.slice(block.from, block.to), fence); assert.deepEqual(parseDiagram(block.source), data);
  assert.equal(diagramBlocks('````markdown\n' + diagramFence(data) + '\n````').length, 0);
  resizeDiagram(data, 2); assert.equal(data.nodes.length, 1); assert.equal(data.arrows.length, 0); removeNode(data, 'a'); assert.equal(data.nodes.length, 0);
  assert.throws(() => parseDiagram('{"version":2,"grid":2,"nodes":[],"arrows":[]}'));
  assert.throws(() => parseDiagram('{"version":1,"grid":2,"nodes":[{"id":"a","row":9,"col":0,"label":"A"}],"arrows":[]}'));
  assert.throws(() => parseDiagram('{"version":1,"grid":2,"nodes":[],"arrows":[{"id":"f","from":"missing","to":"a","label":"f","style":"solid","side":"above"}]}'));
});

test('mobile registers numbering and HTML commands without desktop PDF', async () => {
  const previous = { window: globalThis.window, document: globalThis.document, observer: globalThis.MutationObserver };
  const classes = new Set(['theme-light']);
  const body = { dataset: {} as Record<string, string>,
    style: { getPropertyValue: () => '', getPropertyPriority: () => '', setProperty() {}, removeProperty() {} },
    getAttribute: () => null, removeAttribute() {},
    classList: { contains: (name: string) => classes.has(name), toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name) } };
  globalThis.window = globalThis as any;
  globalThis.document = { body } as any;
  globalThis.MutationObserver = class { observe() {} disconnect() {} } as any;
  Platform.isDesktopApp = false;
  const app: any = { metadataCache: { on() {} }, vault: { on() {} }, workspace: { on() {}, onLayoutReady() {} } };
  const plugin: any = new AcademicNotes(app, { id: 'academic-notes', name: 'Academic Notes', version: '2.7.0' } as any);
  try {
    await plugin.onload();
    assert.equal(plugin.commands.length, 10);
    assert.ok(plugin.commands.every((command: any) => !command.id.endsWith('-pdf')));
    for (const id of ['export-current', 'export-book', 'insert-reference', 'label-block', 'insert-environment', 'refresh', 'start-layout-diagnostics', 'stop-layout-diagnostics'])
      assert.ok(plugin.commands.some((command: any) => command.id === id), id);
    assert.ok(!new AcademicSettings(app, plugin).getSettingDefinitions().some(setting => setting.name === 'Open the PDF in Obsidian after export'));
    assert.equal(pdfAvailability().interfaceAvailable, false);
    plugin.onunload();
  } finally {
    Platform.isDesktopApp = true;
    globalThis.window = previous.window; globalThis.document = previous.document; globalThis.MutationObserver = previous.observer;
  }
});

test('language follows Obsidian with English fallback; settings values and placeholders stay stable', () => {
  const plugin: any = { settings: { ...Engine.DEFAULTS, tocDepth: 3, lightPalette: 'forest', darkPalette: 'radiation' }, saveSettings: async () => {} };
  const names: Record<string, string> = { en: 'Paragraph typography (Beta)', 'zh-CN': '段落排版（Beta）', 'zh-TW': '段落排版（Beta）', de: 'Paragraph typography (Beta)' };
  let baseline: string[][] | undefined;
  for (const [locale, expected] of Object.entries(names)) {
    setLanguage(locale);
    const definitions = new AcademicSettings({} as any, plugin).getSettingDefinitions();
    assert.equal(definitions[0].name, expected);
    const options: string[][] = [], labels: string[] = [];
    const control: any = { setValue() { return this; }, onChange() { return this; }, addOptions(values: Record<string,string>) { options.push(Object.keys(values)); labels.push(...Object.values(values)); return this; } };
    const row: any = { settingEl: new MockElement(), setHeading() {}, addDropdown(fn: any) { fn(control); }, addToggle(fn: any) { fn(control); }, addText(fn: any) { fn(control); } };
    definitions.forEach(d => d.render(row));
    if (!baseline) baseline = options;
    assert.deepEqual(options, baseline, 'Stored option IDs must not depend on language');
    if (!locale.startsWith('zh')) assert.ok(!/[\p{Script=Han}]/u.test(definitions.map(d => d.name + d.desc).join(' ') + labels.join(' ')));
    assert.equal(t('重复块 ID：{0}#^{1}', '用户笔记.md', 'block'), locale.startsWith('zh') ? '重复块 ID：用户笔记.md#^block' : 'Duplicate block ID: 用户笔记.md#^block');
  }
  for (const [key, value] of Object.entries(ENGLISH)) {
    assert.deepEqual((key.match(/\{\d+\}/g) || []).sort(), (value.match(/\{\d+\}/g) || []).sort(), key);
  }
  setLanguage('en');
});

test('custom appearance accepts only known roles, safe colors and bundled motifs', () => {
  assert.deepEqual(parseAppearance('invalid'), {});
  const settings = JSON.stringify({ thm: { light: '#f0eedd', dark: '#112233', motifLight: '#345678', motif: 'quill' }, assumption: { light: 'url(https://bad.invalid)', motif: 'url(x)' }, unknown: { light: '#ffffff' } });
  const light = appearanceValues(settings, false), dark = appearanceValues(settings, true);
  assert.equal(light['--an-color-thm'], '#f0eedd'); assert.equal(dark['--an-color-thm'], '#112233');
  assert.equal(light['--an-ink-thm'], '#000000'); assert.equal(dark['--an-ink-thm'], '#ffffff');
  assert.equal(light['--an-motif-color-thm'], '#345678'); assert.equal(dark['--an-motif-color-thm'], undefined);
  assert.ok(light['--an-symbol-thm'].startsWith('url("data:image/svg+xml,'));
  assert.equal(light['--an-color-assumption'], undefined); assert.equal(light['--an-color-unknown'], undefined);
  assert.equal(appearanceValues('{"thm":{"motif":"none"}}', false)['--an-symbol-thm'], 'none');
  assert.equal(titleInk('#ffffff'), '#000000'); assert.equal(titleInk('#000000'), '#ffffff');
  assert.equal(Object.keys(MOTIFS).length, 9);
});

test('H6 is a heading; explicit figures are numbered; code fences are not declarations', () => {
  const note = Engine.parse('a.md', '## Section\n###### 1.2.3 Heading\n\n> [!figure] Figure\n> image\n\n^fig-one\n\n```md\n## Fake\n> [!thm] Fake\n```');
  Engine.graph([note]);
  assert.equal(note.media.length, 1);
  assert.equal(note.media[0].number, '1.1');
  assert.equal(note.headings[1].level, 6);
  assert.equal(note.theorems.length, 0);
});

test('cross-file references control equation numbering and book renumbering', () => {
  const a = Engine.parse('a.md', '## Section\n$$x=1$$\n\n^eq-one\n\n$$y=2$$\n\n^eq-two');
  const b = Engine.parse('b.md', '[[a#^eq-one]]');
  let graph = Engine.graph([a, b]);
  assert.deepEqual(a.equations.map(e => e.number), ['1.1', '']);
  assert.equal(Engine.refText(b.refs[0].target, graph.settings), 'eq:1.1');
  graph = Engine.graph([a, b], {}, undefined, new Map([['a.md', { chapter: 2, mode: 'chapter-section' }]]));
  assert.equal(a.equations[0].number, '2.1.1');
  assert.equal(graph.resolve('a#^eq-one', 'b.md'), a.equations[0]);
});

test('manual numbers, hidden prefixes and shared theorem counters', () => {
  const note = Engine.parse('a.md', '## A\n> [!thm|1] Manual\n\n> [!def] Auto\n\n> [!proof] Proof\n\n> [!thm|*] Hidden\n\n## B\n> [!lem] Lemma');
  Engine.graph([note], { sharedCounter: true, sectionPrefix: false });
  assert.deepEqual(note.theorems.map(r => r.number), ['1', '2', '', '', '1']);
});

test('subfigure IDs bind to their own nested declarations', () => {
  const note = Engine.parse('figures.md', readFileSync('examples/figures.md', 'utf8'));
  Engine.graph([note]);
  assert.equal(note.blocks.get('fig-initial')?.number, '1.1(a)');
  assert.equal(note.blocks.get('fig-final')?.number, '1.1(b)');
  assert.equal(note.blocks.get('fig-states')?.kind, 'figure');
});

test('environment templates preserve unique IDs and figure options preserve numbering', () => {
  setLanguage('en');
  let source = '> [!thm] Existing\n\n^thm-1\n\n^fig-1\n\n^fig-2-sub-1';
  for (const count of [2, 3, 4, 6, 12]) {
    const result = environmentTemplate('subfigures', source, count, 'auto', 180);
    assert.equal(result.text.slice(result.selection.start, result.selection.end), 'Enter a title');
    const note = Engine.parse('figures.md', '## Images\n\n' + result.text); Engine.graph([note]);
    const group = note.media.find(r => r.kind === 'figure')!;
    assert.equal(group.number, '1.1'); assert.equal(group.manual, null);
    assert.deepEqual(group.layout, { columns: 'auto', height: 180 });
    const children = note.media.filter(r => r.kind === 'subfigure');
    assert.equal(children.length, count);
    children.forEach((child, i) => { assert.equal(child.parent, group); assert.equal(child.number, '1.1(' + String.fromCharCode(97 + i) + ')'); assert.ok(child.id); });
    source += '\n\n' + result.text;
  }
  const ids = [...source.matchAll(/\^([A-Za-z0-9-]+)/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const kind of ['thm', 'def', 'proof', 'remark', 'figure', 'table'] as const) {
    const result = environmentTemplate(kind, source);
    const note = Engine.parse('a.md', result.text);
    assert.equal(note.callouts.length, 1); assert.ok(note.callouts[0].id);
  }
  assert.deepEqual(figureMetadata('7 cols=4 height=180px'), { numbering: '7', layout: { columns: 4, height: 180 } });
  assert.equal(figureMetadata('* cols=2').numbering, '*');
  assert.equal(figureMetadata('').numbering, '');
  assert.deepEqual(figureMetadata('cols=99 height=url(x)'), { numbering: 'auto', layout: { columns: 'auto' } });
  assert.throws(() => environmentTemplate('subfigures', '', 0));
});

test('ambiguous duplicate block IDs do not resolve', () => {
  const note = Engine.parse('a.md', '> [!thm] A\n\n^duplicate\n\n> [!thm] B\n\n^duplicate\n\n[[#^duplicate]]');
  const graph = Engine.graph([note]);
  assert.equal(graph.resolve('#^duplicate', 'a.md'), null);
  assert.ok(graph.warnings.some(w => w.includes('duplicate')));
});

test('untitled unreferenced subfigures have no caption number and do not consume letters', () => {
  const source = '> [!figure] Group\n> > [!subfig]\n> > ![[one.png]]\n>\n> ^blank\n>\n> > [!subfigure] Named\n> > ![[two.png]]\n>\n> ^named\n>\n> > [!subfigure|Z]\n> > ![[three.png]]\n>\n> ^manual\n>\n> > [!subfigure|*]\n> > ![[four.png]]\n>\n> ^hidden\n\n^group';
  const note = Engine.parse('figures.md', source);
  let graph = Engine.graph([note]);
  const children = note.media.filter(r => r.kind === 'subfigure');
  assert.deepEqual(children.map(r => r.number), ['', '1(a)', 'Z', '']);
  assert.equal(graph.resolve('#^blank', 'figures.md'), children[0], 'Block anchors remain available');
  const referring = Engine.parse('other.md', '[[figures#^blank]]\n[[figures#^hidden]]');
  graph = Engine.graph([note, referring]);
  assert.deepEqual(children.map(r => r.number), ['1(a)', '1(b)', 'Z', '']);
  assert.equal(Engine.refText(graph.resolve('figures#^blank', 'other.md'), graph.settings), 'fig 1(a)');
  Engine.graph([note]);
  assert.deepEqual(children.map(r => r.number), ['', '1(a)', 'Z', ''], 'Removing a reference resets hidden captions and counters');
});

test('PDF annotations supply exact page positions and become nested outlines', async () => {
  const doc = await PDFDocument.create(); const pages = [doc.addPage(), doc.addPage()];
  const entries = [{ id: 'h1', title: 'Chapter', level: 1 }, { id: 'h2', title: 'Section', level: 2 }];
  pages.forEach((page, i) => {
    const annotation = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [10, 700, 12, 702],
      A: { S: 'URI', URI: PDFString.of(PROBE + entries[i].id) } });
    page.node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(annotation)]));
  });
  const bytes = await doc.save(); const measurement = await measurePdf(bytes);
  assert.equal(measurement.positions.h2.page, 1);
  const result = await finishPdf(bytes, { prepared: true, title: 'Book', entries }, measurement.positions);
  const final = await PDFDocument.load(result.bytes);
  assert.ok(final.catalog.get(PDFName.of('Outlines')));
  assert.equal(final.getPages()[0].node.Annots()?.size(), 0);
  assert.equal(result.stats.pages, 2);
});


test('appearance settings persist changes independently and reset the selected environment', async () => {
  let saves = 0;
  const plugin: any = { settings: { customAppearance: '{}' }, saveSettings: async () => { saves++; } };
  const tab = new AcademicSettings({} as any, plugin);
  (tab as any).refreshSettings = () => {};
  await tab.changeAppearance('light', '#123456');
  tab.appearanceType = 'def'; await tab.changeAppearance('motif', 'folio');
  Setting.controls = []; tab.renderAppearance(new MockElement() as any);
  const selector = Setting.controls.find(c => c.options?.laurel);
  await selector.change('none');
  assert.equal(parseAppearance(plugin.settings.customAppearance).def.motif, 'none');
  await Setting.controls.find(c => c.click).click();
  assert.deepEqual(parseAppearance(plugin.settings.customAppearance), { thm: { light: '#123456' } });
  assert.equal(saves, 4);
  tab.appearanceType = 'proof'; Setting.controls = []; tab.renderAppearance(new MockElement() as any);
  assert.ok(!Setting.controls.some(c => c.options?.laurel));
});


test('algorithm callouts and fences normalize to the same grammar and independent numbering', () => {
  const body = '\\INPUT $a,b\\in\\mathbb{N}$\n\\WHILE{$b\\ne 0$}\n  \\STATE $(a,b)\\gets(b,a\\bmod b)$\n\\ENDWHILE\n\\RETURN $a$';
  const full = '\\begin{algorithm}\n\\caption{Euclid}\n\\begin{algorithmic}\n' + body + '\n\\end{algorithmic}\n\\end{algorithm}';
  assert.deepEqual(parseAlgorithm(body, 'Euclid'), parseAlgorithm(full));
  assert.equal(parseAlgorithm(body, '\\textbf{Euclid} $x$').title, 'Euclid x');
  const callout = '> [!algorithm] Euclid\n' + body.split('\n').map(line => '> ' + line).join('\n');
  const source = '## Algorithms\n\n> [!thm] Independent\n> Body\n\n^thm-first\n\n' + callout + '\n\n^alg-first\n\n```algorithm\n' + full + '\n```\n\n^alg-second\n\n> [!figure] Picture\n> ![[a.png]]\n\n^fig-first';
  const note = Engine.parse('algorithms.md', source), refs = Engine.parse('refs.md','[[algorithms#^alg-second]]');
  const graph = Engine.graph([note,refs]);
  assert.equal(note.blocks.get('alg-first')?.number,'1.1'); assert.equal(note.blocks.get('alg-second')?.number,'1.2');
  assert.equal(note.theorems[0].number,'1.1'); assert.equal(note.blocks.get('fig-first')?.number,'1.1');
  assert.equal(Engine.refText(graph.resolve('algorithms#^alg-second','refs.md'),graph.settings),'alg 1.2');
  Engine.graph([note, refs], {}, undefined, new Map([['algorithms.md',{chapter:2,mode:'chapter'}]]));
  assert.equal(note.blocks.get('alg-second')?.number,'2.2');
  const plugin = new AcademicNotes(); plugin.settings = { ...PluginDefaults };
  assert.ok(plugin.exportSource(refs,graph).includes('alg 2.2'));
  assert.equal(Engine.parse('bad.md','> [!algorithm] Broken\n> \\WHILE{$a$}\n\n^broken').records[0].suppress,true);
});
test('algorithm source adapters preserve nesting, math and IDs while ignoring code examples and comments', () => {
  const body = '\\STATE $x\\gets 1$';
  const callout = '> > [!algorithm|lines=true]+ Nested $x$\n> > '+body+'\n> >\n> > ^inside\n>\n> Following text';
  const blocks=algorithmBlocks(callout); assert.equal(blocks.length,1); assert.equal(blocks[0].source,body+'\n');
  const note=Engine.parse('nested.md',callout); const rec=note.blocks.get('inside'); assert.equal(rec?.title,'Nested x'); assert.equal(rec?.algorithm?.lineNumbers,true);
  assert.equal(note.equations.length,0);
  for(const wrapper of ['````markdown\n'+callout+'\n````','%%\n'+callout+'\n%%','<!--\n'+callout+'\n-->','---\nexample: text\n'+callout+'\n---','    ```algorithm\n    '+body+'\n    ```']) assert.equal(algorithmBlocks(wrapper).length,0);
  const fence='~~~algorithm\n'+body+'\n~~~\n\n^alg-tilde'; assert.equal(Engine.parse('fence.md',fence).blocks.get('alg-tilde')?.kind,'algorithm');
  const suppressed=Engine.parse('manual.md','> [!algorithm|* lines=false] No number\n> '+body); Engine.graph([suppressed]); assert.equal(suppressed.media[0].number,'');
  assert.equal(suppressed.media[0].algorithm?.lineNumbers,false);
  const numbered=Engine.parse('manual.md','> [!algorithm|A] Custom\n> '+body); Engine.graph([numbered]); assert.equal(numbered.media[0].number,'A');
  assert.equal(parseAlgorithm('\\begin{algorithmic}[1]\n'+body+'\n\\end{algorithmic}').lineNumbers,true);
  assert.throws(()=>parseAlgorithm(body.repeat(3000))); assert.throws(()=>parseAlgorithm('\\IF{$a$}\n'.repeat(90)+body+'\n\\ENDIF'.repeat(90)));
  assert.throws(()=>parseAlgorithm('\\begin{algorithmic}'+body+'\\end{algorithmic}'.repeat(2)));
  for(const kind of ['algorithm','algorithm-fence'] as const) { const template=environmentTemplate(kind,'^alg-1'); assert.match(template.text,/\^alg-2/); assert.equal(algorithmBlocks(template.text).length,1); assert.doesNotThrow(()=>parseAlgorithm(algorithmBlocks(template.text)[0].source)); }
  const state=EditorState.create({doc:'> [!algorithm] Example\n> '+body+'\n\nPlain prose'}); assert.deepEqual(proseLines(state).map(l=>state.doc.lineAt(l.from).text),['Plain prose']);
});


test('custom environments number independently and resolve multilingual cross-file references', () => {
  const settings = { ...Engine.DEFAULTS, customEnvironments: JSON.stringify({ observation: { name: 'Observation', abbr: 'obs', style: 'lem', numbered: true, light: '#4488aa', dark: '#aaddff' }, noteplain: { name: 'Note', abbr: 'N', style: 'remark', numbered: false } }), referenceOverrides: JSON.stringify({ thm: { name: 'Satz', abbr: 'S.' }, algorithm: { name: '算法', abbr: '算法' }, observation: { format: '{name} {number} ({title})' } }) };
  const source = '## A\n> [!thm] One\n> Body\n\n^one\n\n> [!observation] Compactness\n> Content\n\n^obs-one\n\n> [!observation|7] Manual\n> Text\n\n> [!observation|*] No number\n> Text\n\n> [!noteplain] Plain\n> Text\n\n## B\n> [!observation] Second section\n> Text';
  const note = Engine.parse('one.md', source, {}, settings), other = Engine.parse('two.md', '[[one#^obs-one]]');
  const graph = Engine.graph([note, other], settings);
  assert.deepEqual(note.theorems.map(r => r.number), ['1.1','1.1','7','','','2.1']);
  assert.equal(Engine.refText(note.theorems[0], graph.settings), 'S. 1.1');
  assert.equal(Engine.refText(graph.resolve('one#^obs-one','two.md'), graph.settings), 'Observation 1.1 (Compactness)');
  assert.equal(Engine.labelName('thm', settings), 'Satz');
  assert.equal(note.theorems[1].environment?.style, 'lem');
  Engine.graph([note,other],{...settings,sharedCounter:true}); assert.equal(note.theorems[1].number,'1.2');
  Engine.graph([note,other],settings,undefined,new Map([['one.md',{chapter:3,mode:'chapter'}]])); assert.equal(note.theorems[1].number,'3.1');
  const alg = Engine.parse('alg.md','> [!algorithm] Euclid\n> \\RETURN $a$'); Engine.graph([alg],settings); assert.equal(Engine.refText(alg.media[0], settings),'算法 1');
  assert.equal(Engine.parse('disabled.md',source).theorems.length,1);
  assert.match(environmentTemplate('observation','^observation-1').text,/\[!observation\]/);
});

test('environment settings reject reserved IDs, invalid colors and executable-style payloads', () => {
  const raw = JSON.stringify({ thm: {name:'Override'}, algorithm: {name:'Override'}, constructor: {name:'Bad'}, 'bad id': {name:'Bad'}, good: {name:'Good', style:'url(script)', light:'red;display:none', dark:'#abcdef'} });
  const defs = Engine.environments({customEnvironments:raw});
  assert.deepEqual(Object.keys(defs),['good']); assert.equal(defs.good.style,'thm'); assert.equal(defs.good.light,undefined); assert.equal(defs.good.dark,'#abcdef');
  assert.equal(Engine.canon('constructor'),null); assert.equal(Engine.mediaCanon('constructor'),null);
  assert.deepEqual(Engine.environments({customEnvironments:'broken JSON'}),{});
  assert.equal(Engine.validCustomKey('definition'),false); assert.equal(Engine.validCustomKey('observation'),true);
  const overrides=Engine.referenceOverrides({referenceOverrides:JSON.stringify({thm:{abbr:'S.', format:'{abbr} {number}'},unknown:{name:'Unexpected'}})});
  assert.deepEqual(Object.keys(overrides),['thm']);
});
