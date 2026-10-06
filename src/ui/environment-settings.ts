import { Setting, Notice } from 'obsidian';
import { t } from '../i18n';
import Engine from '../indexing/engine';
import { ENVIRONMENT_STYLES, type CustomEnvironment } from '../indexing/environments';
import { paletteOverrides } from '../rendering/palettes';
import type AcademicNotes from '../main';

/** One editor for built-in references and user-defined environments. */
export function renderEnvironmentSettings(container: HTMLElement, plugin: AcademicNotes) {
    const syntaxExamples = { name: 'Observation', key: 'observation' };
    const root = container.createDiv({ cls: 'an-environment-settings' });
    new Setting(root).setName(t('环境与引用')).setHeading();
    root.createEl('p', { text: t('按环境自定义显示名称、引用缩写和完整格式。留空使用默认值；格式支持 {type}、{abbr}、{name}、{number}、{title}、{file}。设置后点击保存。') });
    const form = root.createDiv();
    let selected = 'algorithm';
    const draw = () => {
        form.empty();
        const definitions = Engine.environments(plugin.settings), isNew = !selected, custom = definitions[selected];
        const reference = { ...Engine.referenceOverrides(plugin.settings)[selected] };
        const entry: CustomEnvironment = { ...(custom || { name: '', abbr: '', style: 'thm', numbered: true }) };
        let key = selected;
        const options = Object.fromEntries([...Object.keys(Engine.TYPES), ...Object.keys(Engine.MEDIA), 'equation', ...Object.keys(definitions)].map(key => [key, Engine.typeNames(key, plugin.settings)[0] + ` [${key}]`]));
        new Setting(form).setName(t('选择环境')).addDropdown(d => d.addOptions({ ...options, '': t('新建环境') }).setValue(selected).onChange(value => { d.selectEl.blur(); selected = value; draw(); }));
        if (isNew || custom) new Setting(form).setName(t('环境标识')).setDesc(t('如 observation，对应 [!observation]；使用小写英文字母、数字和连字符，以字母开头，不能占用已有类型。保存后不可改名。')).addText(c => c.setValue(key).setDisabled(!!selected).setPlaceholder(syntaxExamples.key).onChange(value => { key = value.trim(); }));
        new Setting(form).setName(t('显示名称')).setDesc(t('用于环境标题及引用的全称；可填写任意语言。')).addText(c => c.setValue(isNew ? entry.name : reference.name || custom?.name || '').setPlaceholder(isNew ? syntaxExamples.name : Engine.labelName(selected)).onChange(value => { reference.name = value; entry.name = value; }));
        new Setting(form).setName(t('引用缩写')).addText(c => c.setValue(isNew ? entry.abbr : reference.abbr || custom?.abbr || '').setPlaceholder(isNew ? 'obs' : Engine.ABBR[selected] || selected).onChange(value => { reference.abbr = value; entry.abbr = value; }));
        new Setting(form).setName(t('此环境的引用格式')).setDesc(t('例如：{abbr} {number}、算法 {number}、Satz {number}。留空沿用对应的全局格式。')).addText(c => c.setValue(reference.format || '').setPlaceholder('{abbr} {number}').onChange(value => { reference.format = value; }));
        if (isNew || custom) {
            new Setting(form).setName(t('基础外观')).addDropdown(d => d.addOptions(Object.fromEntries(ENVIRONMENT_STYLES.map(style => [style, Engine.TYPES[style][0]]))).setValue(entry.style).onChange(value => { entry.style = value as CustomEnvironment['style']; }));
            new Setting(form).setName(t('自动编号')).addToggle(c => c.setValue(entry.numbered).onChange(value => { entry.numbered = value; }));
            form.createEl('p', { text: t('颜色在配色与外观中按色板设置；编号遵循下方的编号规则。') });
            if (custom) form.createEl('p', { cls: 'an-environment-example', text: `> [!${selected}] ${t('标题')}\n> ${t('正文')}\n\n^${selected}-example` });
        }
        const actions = new Setting(form).addButton(b => b.setButtonText(t('保存')).setCta().onClick(async () => {
            if (isNew || custom) {
                const current = Engine.environments(plugin.settings);
                if (!Engine.validCustomKey(key) || !entry.name.trim() || (isNew && (Object.hasOwn(current, key) || Object.keys(current).length >= 64))) { new Notice(t('请检查标识和名称；标识不能重复或占用内置环境。')); return; }
                current[key] = entry;
                plugin.settings.customEnvironments = JSON.stringify(Engine.environments({ customEnvironments: JSON.stringify(current) }));
            }
            const all = Engine.referenceOverrides(plugin.settings); all[key] = reference;
            plugin.settings.referenceOverrides = JSON.stringify(Engine.referenceOverrides({ ...plugin.settings, referenceOverrides: JSON.stringify(all) }));
            await plugin.saveSettings(); new Notice(t('已保存。'));
            if (isNew) { selected = key; draw(); }
        }));
        if (!isNew) actions.addButton(b => b.setButtonText(t('恢复默认')).onClick(async () => {
            const all = Engine.referenceOverrides(plugin.settings); delete all[selected]; plugin.settings.referenceOverrides = JSON.stringify(all);
            await plugin.saveSettings(); draw();
        }));
        if (custom) actions.addButton(b => b.setButtonText(t('删除环境')).onClick(async () => {
            const current = Engine.environments(plugin.settings); delete current[selected];
            plugin.settings.customEnvironments = JSON.stringify(current);
            const refs = Engine.referenceOverrides(plugin.settings); delete refs[selected]; plugin.settings.referenceOverrides = JSON.stringify(refs);
            const palettes = paletteOverrides(plugin.settings); for (const profile of Object.values(palettes)) delete profile[selected]; plugin.settings.paletteAppearance = JSON.stringify(palettes);
            await plugin.saveSettings(); selected = 'algorithm'; draw();
        }));
    };
    draw();
}
