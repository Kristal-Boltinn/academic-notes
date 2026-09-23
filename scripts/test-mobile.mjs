import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Evaluate the distributable main.js with the modules unavailable on iPadOS.
// This checks the actual release entry point rather than only TypeScript imports.
const nativeRequire = createRequire(import.meta.url);
const loaded = [];
class Plugin {
  constructor(app, manifest) { this.app = app; this.manifest = manifest; this.commands = []; }
  async loadData() { return {}; }
  addCommand(command) { this.commands.push(command); }
  addSettingTab() {} registerMarkdownPostProcessor() {} registerMarkdownCodeBlockProcessor() {}
  registerEditorExtension() {} registerEditorSuggest() {} registerEvent() {} register() {}
}
class HostComponent { constructor() {} }
const Platform = { isDesktopApp: false, isMobile: true, isIosApp: true };
const obsidian = {
  Plugin, Platform, getLanguage: () => 'en',
  PluginSettingTab: HostComponent, Modal: HostComponent, FuzzySuggestModal: HostComponent,
  EditorSuggest: HostComponent, MarkdownRenderChild: HostComponent, MarkdownView: HostComponent,
  Component: HostComponent, TFile: HostComponent, Setting: HostComponent,
  Notice: HostComponent, normalizePath: value => value, finishRenderMath: async () => {}
};
const bodyClasses = new Set(['theme-light', 'is-mobile']);
const body = {
  dataset: {}, getAttribute: () => null, removeAttribute() {},
  style: { getPropertyValue: () => '', getPropertyPriority: () => '', setProperty() {}, removeProperty() {} },
  classList: { contains: key => bodyClasses.has(key), toggle: (key, enabled) => enabled ? bodyClasses.add(key) : bodyClasses.delete(key) }
};
const module = { exports: {} };
const sandbox = {
  module, exports: module.exports, document: { body }, window: { setTimeout, clearTimeout },
  MutationObserver: class { observe() {} disconnect() {} },
  require(id) {
    loaded.push(id);
    if (id === 'obsidian') return obsidian;
    if (id === 'electron' || id === '@electron/remote' || id.startsWith('node:'))
      throw new Error(`Desktop module loaded on mobile: ${id}`);
    return nativeRequire(id);
  }
};
runInNewContext(await readFile('main.js', 'utf8'), sandbox, { filename: 'main.js' });
const AcademicNotes = module.exports.default;
assert.equal(typeof AcademicNotes, 'function');
const app = { metadataCache: { on() {} }, vault: { on() {} }, workspace: { on() {}, onLayoutReady() {} } };
const plugin = new AcademicNotes(app, { id: 'academic-notes', name: 'Academic Notes', version: '2.7.0' });
await plugin.onload();
assert.equal(plugin.commands.length, 7);
assert.ok(plugin.commands.every(command => !command.id.endsWith('-pdf')));
assert.ok(plugin.commands.some(command => command.id === 'insert-reference'));
plugin.onunload();
assert.ok(!loaded.some(id => id === 'electron' || id === '@electron/remote' || id.startsWith('node:')));
console.log('Built plugin loaded and registered mobile commands without Electron or Node modules.');
