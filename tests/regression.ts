import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Engine from '../src/indexing/engine';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { measurePdf, finishPdf, PROBE } from '../src/export/pdf-postprocess';
import AcademicNotes from '../src/main';

test('plugin lifecycle registers new commands, drops removed settings and restores appearance', async () => {
  const classes = new Set(['theme-light']);
  const body = { dataset: {} as Record<string, string>,
    getAttribute: () => null, removeAttribute: () => {},
    classList: { contains: (s: string) => classes.has(s), toggle: (s: string, value: boolean) => value ? classes.add(s) : classes.delete(s) } };
  const previous = { document: globalThis.document, observer: globalThis.MutationObserver };
  globalThis.document = { body } as any;
  globalThis.MutationObserver = class { observe() {} disconnect() {} } as any;
  const app: any = { metadataCache: { on() {} }, vault: { on() {} }, workspace: { on() {}, onLayoutReady() {} } };
  const plugin: any = new AcademicNotes(app, { id: 'academic-notes', name: 'Academic Notes', version: '2.2.0' } as any);
  plugin.data = { legacy: true, legacyCaptions: true, followPhycat: true, pythonPath: 'unused', neutralBody: true, lightPalette: 'mint' };
  try {
    await plugin.onload();
    assert.equal(plugin.commands.length, 9);
    assert.ok(!plugin.commands.some((c: any) => c.id === 'setup-pdf'));
    for (const key of ['legacy', 'legacyCaptions', 'followPhycat', 'pythonPath']) assert.ok(!(key in plugin.settings));
    assert.equal(body.dataset.anPalette, 'mint');
    assert.ok(classes.has('phb-neutral-body'));
    plugin.onunload();
    assert.ok(!classes.has('phb-neutral-body') && !classes.has('an-active'));
  } finally { globalThis.document = previous.document; globalThis.MutationObserver = previous.observer; }
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

test('ambiguous duplicate block IDs do not resolve', () => {
  const note = Engine.parse('a.md', '> [!thm] A\n\n^duplicate\n\n> [!thm] B\n\n^duplicate\n\n[[#^duplicate]]');
  const graph = Engine.graph([note]);
  assert.equal(graph.resolve('#^duplicate', 'a.md'), null);
  assert.ok(graph.warnings.some(w => w.includes('duplicate')));
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
