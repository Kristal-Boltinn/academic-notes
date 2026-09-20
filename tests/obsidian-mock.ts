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
export class Setting {}
export const MarkdownRenderer = {};
export const Platform = { isDesktopApp: true };
export const normalizePath = (path: string) => path.replace(/\\/g, '/');
export const editorInfoField = {}, editorLivePreviewField = {};
export const finishRenderMath = async () => {};
export const renderMath = () => {};
