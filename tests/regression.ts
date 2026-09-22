import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Engine from '../src/indexing/engine';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { measurePdf, finishPdf, PROBE } from '../src/export/pdf-postprocess';
import AcademicNotes from '../src/main';
import { ENGLISH, setLanguage, t } from '../src/i18n';
import { AcademicSettings } from '../src/ui/settings-tab';
import { setTestLanguage, MockElement, Setting } from './obsidian-mock';
import { environmentTemplate } from '../src/ui/environment';
import { figureMetadata } from '../src/rendering/figure-layout';
import { appearanceValues, parseAppearance, titleInk, MOTIFS } from '../src/rendering/custom-appearance';

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
  plugin.data = { legacy: true, legacyCaptions: true, followPhycat: true, pythonPath: 'unused', neutralBody: true, lightPalette: 'mint', customAppearance: JSON.stringify({ thm: { light: '#abcdef', dark: '#fedcba', motif: 'laurel' } }) };
  try {
    setTestLanguage('en');
    await plugin.onload();
    assert.equal(plugin.commands.length, 10);
    assert.equal(plugin.commands.find((c: any) => c.id === 'export-current-pdf').name, 'Export current note to PDF');
    assert.ok(!plugin.commands.some((c: any) => c.id === 'setup-pdf'));
    for (const key of ['legacy', 'legacyCaptions', 'followPhycat', 'pythonPath']) assert.ok(!(key in plugin.settings));
    assert.equal(body.dataset.anPalette, 'mint');
    assert.ok(classes.has('phb-neutral-body'));
    assert.equal(inline.get('--an-color-thm'), '#abcdef');
    classes.delete('theme-light'); classes.add('theme-dark'); plugin.applyAppearance();
    assert.equal(inline.get('--an-color-thm'), '#fedcba');
    plugin.onunload();
    assert.equal(inline.get('--an-color-thm'), '#123456');
    assert.equal(inline.has('--an-symbol-thm'), false);
    assert.ok(!classes.has('phb-neutral-body') && !classes.has('an-active'));
  } finally { globalThis.window = previous.window; globalThis.document = previous.document; globalThis.MutationObserver = previous.observer; }
});

test('language follows Obsidian with English fallback; settings values and placeholders stay stable', () => {
  const plugin: any = { settings: { ...Engine.DEFAULTS, tocDepth: 3, lightPalette: 'forest', darkPalette: 'radiation' }, saveSettings: async () => {} };
  const names: Record<string, string> = { en: 'Numbering and references', 'zh-CN': '编号与引用', 'zh-TW': '编号与引用', de: 'Numbering and references' };
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
