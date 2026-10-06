import { Setting, Notice } from 'obsidian';
import { t } from '../i18n';
import Engine from '../indexing/engine';
import { ENVIRONMENT_STYLES, type CustomEnvironment } from '../indexing/environments';
import type AcademicNotes from '../main';

/** Explicit save buttons keep typing and native selectors stable on mobile. */
export function renderEnvironmentSettings(container: HTMLElement, plugin: AcademicNotes) {
    const syntaxExamples = { key: 'observation', abbreviation: 'obs', color: '#4488aa' };
    const root = container.createDiv({ cls: 'an-environment-settings' });
    new Setting(root).setName(t('环境名称与引用')).setHeading();
    root.createEl('p', { text: t('按环境自定义显示名称、引用缩写和完整格式。留空使用默认值；格式支持 {type}、{abbr}、{name}、{number}、{title}、{file}。设置后点击保存。') });
    const referenceForm = root.createDiv();
    let selected = 'algorithm';
    const options = () => Object.fromEntries([...Object.keys(Engine.TYPES), ...Object.keys(Engine.MEDIA), 'equation', ...Object.keys(Engine.environments(plugin.settings))].map(key => [key, Engine.typeNames(key, plugin.settings)[0] + ` [${key}]`]));
    const drawReference = () => {
        referenceForm.empty();
        const entry = { ...Engine.referenceOverrides(plugin.settings)[selected] };
        new Setting(referenceForm).setName(t('选择环境')).addDropdown(d => d.addOptions(options()).setValue(selected).onChange(value => { d.selectEl.blur(); selected = value; drawReference(); }));
        new Setting(referenceForm).setName(t('显示名称')).setDesc(t('用于环境标题及引用的全称；可填写任意语言。')).addText(c => c.setValue(entry.name || '').setPlaceholder(Engine.labelName(selected)).onChange(value => { entry.name = value; }));
        new Setting(referenceForm).setName(t('引用缩写')).addText(c => c.setValue(entry.abbr || '').setPlaceholder(Engine.ABBR[selected] || selected).onChange(value => { entry.abbr = value; }));
        new Setting(referenceForm).setName(t('此环境的引用格式')).setDesc(t('例如：{abbr} {number}、算法 {number}、Satz {number}。留空沿用对应的全局格式。')).addText(c => c.setValue(entry.format || '').setPlaceholder('{abbr} {number}').onChange(value => { entry.format = value; }));
        new Setting(referenceForm).addButton(b => b.setButtonText(t('保存')).setCta().onClick(async () => {
            const all = Engine.referenceOverrides(plugin.settings); all[selected] = entry;
            // Normalize through the same validator used at render time.
            plugin.settings.referenceOverrides = JSON.stringify(Engine.referenceOverrides({ ...plugin.settings, referenceOverrides: JSON.stringify(all) }));
            await plugin.saveSettings(); new Notice(t('已保存。'));
        })).addButton(b => b.setButtonText(t('恢复默认')).onClick(async () => { const all = Engine.referenceOverrides(plugin.settings); delete all[selected]; plugin.settings.referenceOverrides = JSON.stringify(all); await plugin.saveSettings(); drawReference(); }));
    };
    drawReference();
    new Setting(root).setName(t('自定义新环境')).setHeading();
    root.createEl('p', { text: t('新环境沿用数学框或 Remark 的外观，可选择是否编号并设置浅深配色。编号遵循当前分节和共享计数器设置；正文仍使用 Markdown。最多 64 个。') });
    const customForm = root.createDiv();
    let customKey = '';
    const drawCustom = () => {
        customForm.empty();
        const all = Engine.environments(plugin.settings);
        const entry: CustomEnvironment = { ...(all[customKey] || { name: '', abbr: '', style: 'thm', numbered: true }) };
        let key = customKey;
        new Setting(customForm).setName(t('编辑环境')).addDropdown(d => d.addOptions({ '': t('新建环境'), ...Object.fromEntries(Object.entries(all).map(([key, value]) => [key, value.name + ` [${key}]`])) }).setValue(customKey).onChange(value => { d.selectEl.blur(); customKey = value; drawCustom(); }));
        new Setting(customForm).setName(t('环境标识')).setDesc(t('如 observation，对应 [!observation]；使用小写英文字母、数字和连字符，以字母开头，不能占用已有类型。保存后不可改名。')).addText(c => c.setValue(key).setDisabled(!!customKey).setPlaceholder(syntaxExamples.key).onChange(value => { key = value.trim(); }));
        new Setting(customForm).setName(t('显示名称')).addText(c => c.setValue(entry.name).setPlaceholder('Observation').onChange(value => { entry.name = value; }));
        new Setting(customForm).setName(t('引用缩写')).addText(c => c.setValue(entry.abbr).setPlaceholder(syntaxExamples.abbreviation).onChange(value => { entry.abbr = value; }));
        new Setting(customForm).setName(t('基础外观')).addDropdown(d => d.addOptions(Object.fromEntries(ENVIRONMENT_STYLES.map(style => [style, Engine.TYPES[style][0]]))).setValue(entry.style).onChange(value => { entry.style = value as CustomEnvironment['style']; }));
        new Setting(customForm).setName(t('自动编号')).addToggle(c => c.setValue(entry.numbered).onChange(value => { entry.numbered = value; }));
        for (const mode of ['light', 'dark'] as const) new Setting(customForm).setName(mode === 'light' ? t('浅色模式主色') : t('深色模式主色')).setDesc(t('留空跟随基础外观的当前色板，或填写 #RRGGBB。')).addText(c => c.setValue(entry[mode] || '').setPlaceholder(syntaxExamples.color).onChange(value => { entry[mode] = value.trim(); }));
        const status = customForm.createEl('p', { cls: 'an-environment-example', text: customKey ? `> [!${customKey}] ${t('标题')}\n> ${t('正文')}\n\n^${customKey}-example` : '' });
        new Setting(customForm).addButton(b => b.setButtonText(t('保存环境')).setCta().onClick(async () => {
            const current = Engine.environments(plugin.settings);
            if (!Engine.validCustomKey(key) || !entry.name.trim() || (!customKey && (Object.hasOwn(current, key) || Object.keys(current).length >= 64)) || [entry.light, entry.dark].some(color => color && !/^#[0-9a-f]{6}$/i.test(color))) { new Notice(t('请检查标识、名称和颜色；标识不能重复或占用内置环境。')); return; }
            current[key] = entry;
            plugin.settings.customEnvironments = JSON.stringify(Engine.environments({ customEnvironments: JSON.stringify(current) }));
            await plugin.saveSettings(); customKey = key;
            status.textContent = `> [!${key}] ${t('标题')}\n> ${t('正文')}\n\n^${key}-example`;
            new Notice(t('已保存。')); drawCustom(); drawReference();
        })).addButton(b => b.setButtonText(t('删除环境')).setDisabled(!customKey).onClick(async () => {
            const current = Engine.environments(plugin.settings); delete current[customKey];
            plugin.settings.customEnvironments = JSON.stringify(current);
            const refs = Engine.referenceOverrides(plugin.settings); delete refs[customKey]; plugin.settings.referenceOverrides = JSON.stringify(refs);
            await plugin.saveSettings(); if (selected === customKey) selected = 'algorithm'; customKey = ''; drawCustom(); drawReference();
        }));
    };
    drawCustom();
}
