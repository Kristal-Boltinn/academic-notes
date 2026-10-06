export * from './obsidian-mock';
import { StateField } from '@codemirror/state';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { CHTML } from 'mathjax-full/js/output/chtml.js';
import { browserAdaptor } from 'mathjax-full/js/adaptors/browserAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
RegisterHTMLHandler(browserAdaptor());
const mathDocument = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'local' }) });
const commonDocument = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new CHTML() });
let mathOutput: 'svg' | 'chtml' | 'failure' = 'svg';
export const setMathOutput = (mode: typeof mathOutput) => { mathOutput = mode; };
export const renderMath = (source: string, display: boolean) => {
  if (mathOutput === 'failure') throw new Error('Native math renderer unavailable');
  return (mathOutput === 'chtml' ? commonDocument : mathDocument).convert(source, { display, em: 16, ex: 8, containerWidth: 700 }) as HTMLElement;
};
export const finishRenderMath = async () => {};
export const editorInfoField = StateField.define({ create: () => ({ file: { path: 'live.md' } }), update: value => value });
export const editorLivePreviewField = StateField.define({ create: () => true, update: value => value });
export class MarkdownRenderChild {
  constructor(public containerEl: HTMLElement) {}
  onload() {}
  onunload() {}
  unload() { this.onunload(); }
}
// Mirror the host's current branch: declarative definitions suppress display().
export function showSettingTab(tab: { getSettingDefinitions: () => any[]; display: () => void; containerEl: HTMLElement }) {
  const definitions=tab.getSettingDefinitions();
  if (definitions.length) { for (const item of definitions) if(item.render) item.render(new Setting(tab.containerEl)); }
  else tab.display();
}
export class PluginSettingTab {
  containerEl = document.createElement('div');
  constructor(..._args: unknown[]) {}
}
export class Setting {
  settingEl: HTMLElement; nameEl: HTMLElement; descEl: HTMLElement;
  constructor(parent: HTMLElement) {
    this.settingEl = parent.createDiv({ cls: 'setting-item' });
    const info = this.settingEl.createDiv({cls:'setting-item-info'});
    this.nameEl = info.createDiv({cls:'setting-item-name'}); this.descEl = info.createDiv({cls:'setting-item-description'});
    this.settingEl.createDiv({cls:'setting-item-control'});
  }
  setName(text: string) { this.nameEl.textContent = text; return this; }
  setDesc(text: string) { this.descEl.textContent = text; return this; }
  setHeading() { this.settingEl.classList.add('setting-item-heading'); return this; }
  control(tag: string, type: string, callback: (control: any) => void) {
    const el = this.settingEl.querySelector<HTMLElement>('.setting-item-control')!.createEl(tag as 'input', { type });
    const control: any = {
      selectEl: el, toggleEl: el, buttonEl: el,
      setValue(value: any) { if (type === 'checkbox') el.checked = value; else el.value = value; return this; },
      setPlaceholder(value: string) { el.placeholder = value; return this; },
      setCta() { return this; },
      setDisabled(value: boolean) { el.disabled = value; return this; },
      addOptions(values: Record<string, string>) { for (const [value, label] of Object.entries(values)) { const option = document.createElement('option'); option.value = value; option.textContent = label; el.appendChild(option); } return this; },
      setButtonText(text: string) { el.textContent = text; return this; },
      onChange(fn: (value: any) => void) { el.addEventListener('change', () => { void fn(type === 'checkbox' ? el.checked : el.value); }); return this; },
      onClick(fn: () => void) { el.addEventListener('click', () => { void fn(); }); return this; }
    };
    callback(control); return this;
  }
  addDropdown(fn: any) { return this.control('select', '', fn); }
  addToggle(fn: any) { return this.control('input', 'checkbox', fn); }
  addColorPicker(fn: any) { return this.control('input', 'color', fn); }
  addText(fn: any) { return this.control('input', 'text', fn); }
  addButton(fn: any) { return this.control('button', 'button', fn); }
}
