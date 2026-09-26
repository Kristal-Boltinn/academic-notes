export * from './obsidian-mock';
import { StateField } from '@codemirror/state';
export const editorInfoField = StateField.define({ create: () => ({ file: { path: 'live.md' } }), update: value => value });
export const editorLivePreviewField = StateField.define({ create: () => true, update: value => value });
export class PluginSettingTab {
  containerEl = document.createElement('div');
  constructor(..._args: unknown[]) {}
}
export class Setting {
  settingEl: HTMLElement; nameEl: HTMLElement; descEl: HTMLElement;
  constructor(parent: HTMLElement) {
    this.settingEl = parent.createDiv({ cls: 'setting-item' });
    this.nameEl = this.settingEl.createDiv(); this.descEl = this.settingEl.createDiv();
  }
  setName(text: string) { this.nameEl.textContent = text; return this; }
  setDesc(text: string) { this.descEl.textContent = text; return this; }
  setHeading() { return this; }
  control(tag: string, type: string, callback: (control: any) => void) {
    const el = this.settingEl.createEl(tag as 'input', { type });
    const control: any = {
      selectEl: el, toggleEl: el, buttonEl: el,
      setValue(value: any) { if (type === 'checkbox') el.checked = value; else el.value = value; return this; },
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
