import { EditorState, StateField } from '@codemirror/state';
import { EditorView, Decoration, WidgetType } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField } from 'obsidian';
import { AcademicSettings } from '../src/ui/settings-tab';
import { DEFAULTS } from '../src/settings';
import Engine from '../src/indexing/engine';
import { titleRecord, mediaRecord, createLiveExtension } from '../src/rendering/adapters';

const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const settle = () => new Promise(resolve => setTimeout(resolve, 120));
function helpers() {
  const create = (tag: string, options: any = {}) => {
    const el = document.createElement(tag);
    if (options.cls) el.className = options.cls;
    if (options.text) el.textContent = options.text;
    if (options.type) el.setAttribute('type', options.type);
    for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, String(value));
    return el;
  };
  Object.defineProperty(document, 'win', { value: window, configurable: true });
  for (const [method, tag] of [['createDiv', 'div'], ['createSpan', 'span'], ['createEl', '']]) {
    const fn = (first: any, second: any) => create(tag || first, tag ? first : second);
    (window as any)[method] = fn;
    (HTMLElement.prototype as any)[method] = function(first: any, second: any) { const el = fn(first, second); this.appendChild(el); return el; };
  }
  (HTMLElement.prototype as any).empty = function() { this.replaceChildren(); };
  (HTMLElement.prototype as any).addClass = function(name: string) { this.classList.add(name); };
}
function callout(type = 'thm') {
  const box = document.createElement('div'); box.className = 'callout'; box.dataset.callout = type;
  const title = box.createDiv({ cls: 'callout-title' }).createDiv({ cls: 'callout-title-inner', text: 'Original title' });
  box.createDiv({ cls: 'callout-content', text: 'Body' });
  return { box, title };
}
export async function runUiRegressions() {
  helpers();
  const host = document.body.createDiv();
  const style = host.createEl('style', { text: '.ui-test-scroll{height:320px;overflow:auto}.ui-test-scroll .setting-item{min-height:48px}.cm-editor{height:220px}.cm-scroller{overflow:auto}' });
  const scroll = host.createDiv({ cls: 'ui-test-scroll' });
  const plugin: any = { settings: { ...DEFAULTS }, saveSettings: async () => {} };
  const tab = new AcademicSettings({} as any, plugin); scroll.appendChild(tab.containerEl); tab.display();
  scroll.createDiv({ attr: { style: 'height:400px' } });
  const firstRow = tab.containerEl.firstElementChild;
  const section = tab.containerEl.querySelector<HTMLElement>('.an-custom-appearance-row')!;
  scroll.scrollTop = section.offsetTop - scroll.offsetTop;
  const top = scroll.scrollTop; check(top > 500, 'settings fixture must start well below the top');
  const control = (id: string) => section.querySelector<HTMLElement>(`[data-an-control="${id}"]`)!;
  for (const id of ['laurel', 'compass', 'orbit', 'light', 'motif', 'environment', 'reset']) {
    const el = control(id); el.focus({ preventScroll: true });
    if (el instanceof HTMLSelectElement) { el.value = id === 'motif' ? 'rosette' : 'def'; el.dispatchEvent(new Event('change')); }
    else el.click();
    await settle();
    check(tab.containerEl.firstElementChild === firstRow, 'appearance must not recreate other settings');
    check(Math.abs(scroll.scrollTop - top) < 2, `${id}: settings scroll position changed`);
    check(document.activeElement === control(id), `${id}: control focus lost`);
    if (['laurel', 'compass', 'orbit'].includes(id)) check(control(id).getAttribute('aria-pressed') === 'true', 'repeated gallery update must affect the visible section');
  }
  scroll.remove();

  const source = '> [!thm] Original title\n> Body\n\n' + 'A paragraph.\n\n'.repeat(80);
  const note = Engine.parse('live.md', source);
  const record = note.theorems[0]; record.number = '1';
  const editable = host.createDiv({ cls: 'cm-content', attr: { contenteditable: 'true' } });
  const native = callout(); editable.appendChild(native.box);
  const textNode = native.title.firstChild!;
  for (let n = 0; n < 20; n++) titleRecord(native.box, record);
  check(native.title.firstChild === textNode && !native.box.classList.contains('an-math-callout'), 'editable source DOM must remain owned by the editor');
  native.box.contentEditable = 'false'; native.title.contentEditable = 'true';
  titleRecord(native.box, record);
  check(native.title.firstChild === textNode, 'editable title inside a widget must not be reparented');
  native.title.removeAttribute('contenteditable');
  native.box.querySelector('.callout-content')!.appendChild(document.createElement('input')).type = 'checkbox';
  titleRecord(native.box, record);
  check(!!native.title.querySelector('.phb-type-label'), 'read-only widget must still receive numbering');
  const media = callout('figure'); media.box.contentEditable = 'false'; editable.appendChild(media.box);
  const mediaRec: any = { kind: 'figure', key: 'figure', line: 3, title: 'Original title', number: '1', layout: { columns: 'auto', height: 180 } };
  mediaRecord(media.box, mediaRec);
  const observer = new MutationObserver(() => {});
  observer.observe(editable, { childList: true, attributes: true, characterData: true, subtree: true });
  for (let n = 0; n < 20; n++) { titleRecord(native.box, record); mediaRecord(media.box, mediaRec); }
  check(observer.takeRecords().length === 0, 'unchanged rendering must produce no DOM mutations');
  observer.disconnect(); editable.remove();

  // Real CodeMirror, with a native-style editable title inside a read-only widget.
  let widgetTitle: HTMLElement;
  class NativeCallout extends WidgetType {
    eq() { return true; }
    toDOM() { const { box, title } = callout(); widgetTitle = title; title.contentEditable = 'true'; return box; }
  }
  const widgets = StateField.define({
    create: () => Decoration.set([Decoration.widget({ widget: new NativeCallout(), block: true }).range(0)]),
    update: (value, tr) => value.map(tr.changes), provide: field => EditorView.decorations.from(field)
  });
  const errors: unknown[] = [];
  const livePlugin: any = { settings: { ...DEFAULTS, livePreview: true }, graph: { notes: new Map([['live.md', note]]) }, editorViews: new Set(), recordError: (...args: unknown[]) => errors.push(args) };
  const extension = createLiveExtension(livePlugin);
  const view = new EditorView({ parent: host, state: EditorState.create({ doc: source, extensions: [editorInfoField, editorLivePreviewField, widgets, extension] }) });
  try {
    await settle();
    widgetTitle!.focus(); widgetTitle!.textContent = 'Edited title';
    const editedNode = widgetTitle!.firstChild!;
    const selection = document.getSelection()!; selection.setPosition(editedNode, 5);
    for (let n = 0; n < 8; n++) { view.dispatch({ effects: livePlugin.refreshEffect.of(n) }); await settle(); }
    check(widgetTitle!.firstChild === editedNode && selection.anchorNode === editedNode && selection.anchorOffset === 5, 'refresh must preserve native title DOM and caret');
    widgetTitle!.blur(); widgetTitle!.removeAttribute('contenteditable');
    view.dispatch({ effects: livePlugin.refreshEffect.of(9) }); await settle();
    check(!!widgetTitle!.querySelector('.phb-type-label'), 'numbering must resume after title editing');
    view.scrollDOM.scrollTop = 250; view.requestMeasure(); await settle();
    const position = view.scrollDOM.scrollTop; check(position > 0, 'editor must scroll after editing');
    let mutations = 0;
    const idleObserver = new MutationObserver(records => { mutations += records.length; });
    idleObserver.observe(widgetTitle!.parentElement!.parentElement!, { attributes: true, childList: true, characterData: true, subtree: true });
    for (let n = 0; n < 8; n++) { view.dispatch({ effects: livePlugin.refreshEffect.of(n + 10) }); await settle(); }
    idleObserver.disconnect();
    check(mutations === 0, 'idle widget must not enter a DOM repaint feedback loop');
    check(view.scrollDOM.scrollTop === position, 'editor scroll must remain stable after title editing');
    check(errors.length === 0, 'Live Preview raised an error');
  } finally { view.destroy(); style.remove(); host.remove(); }
  return 'Settings scroll/focus and native title ownership, caret, idle mutations and CodeMirror scrolling passed';
}
