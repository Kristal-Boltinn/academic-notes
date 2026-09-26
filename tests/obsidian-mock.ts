export class Plugin {
  [key: string]: any;
  commands: any[] = [];
  constructor(public app: any = {}, public manifest: any = {}) {}
  async loadData() { return this.data; }
  async saveData(data: any) { this.data = data; }
  addCommand(command: any) { this.commands.push(command); }
  addSettingTab() {}
  registerMarkdownPostProcessor() {}
  registerMarkdownCodeBlockProcessor() {}
  registerEditorExtension() {}
  registerEditorSuggest() {}
  registerEvent() {}
  register() {}
}
export class PluginSettingTab { constructor(public app: any, public plugin: any) {} }
export class Modal { constructor(public app: any) {} }
export class FuzzySuggestModal extends Modal {}
export class EditorSuggest extends Modal {}
export class MarkdownRenderChild {}
export class MarkdownView {}
export class Component {}
export class TFile {}
export class Notice {}
export class MockElement {
  style = { setProperty() {} };
  addClass() {} empty() {} addEventListener() {}
  createDiv() { return new MockElement(); } createEl() { return new MockElement(); } createSpan() { return new MockElement(); }
}
export class Setting {
  static controls: any[] = [];
  settingEl = new MockElement();
  constructor(..._args: any[]) {}
  setName(_value: string) { return this; } setDesc(_value: string) { return this; } setHeading() { return this; }
  addControl(fn: any) { const c: any = { selectEl: { dataset: {} }, toggleEl: { dataset: {} }, buttonEl: { dataset: {} }, setValue(v: any) { this.value = v; return this; }, setDisabled(v: boolean) { this.disabled = v; return this; }, addOptions(v: any) { this.options = v; return this; }, setButtonText(v: string) { this.text = v; return this; }, onChange(fn: any) { this.change = fn; return this; }, onClick(fn: any) { this.click = fn; return this; } }; fn(c); Setting.controls.push(c); return this; }
  addDropdown(fn: any) { return this.addControl(fn); } addToggle(fn: any) { return this.addControl(fn); } addColorPicker(fn: any) { return this.addControl(fn); } addButton(fn: any) { return this.addControl(fn); }
}
export const MarkdownRenderer = {};
export const Platform = { isDesktopApp: true };
let locale = 'en';
export const getLanguage = () => locale;
export const setTestLanguage = (value: string) => { locale = value; };
export const normalizePath = (path: string) => path.replace(/\\/g, '/');
export const editorInfoField = {}, editorLivePreviewField = {};
export const finishRenderMath = async () => {};
export const renderMath = () => {};
