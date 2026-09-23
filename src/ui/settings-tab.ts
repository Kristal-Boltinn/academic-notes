import { t } from '../i18n';
import Engine from '../indexing/engine';
import { MOTIFS, motifMask, parseAppearance, type AppearanceEntry } from '../rendering/custom-appearance';
import type AcademicNotes from '../main';
import type { App } from 'obsidian';
import type { AcademicSettingsData } from '../settings';
type BooleanKey = { [K in keyof AcademicSettingsData]: AcademicSettingsData[K] extends boolean ? K : never }[keyof AcademicSettingsData];
type StringKey = { [K in keyof AcademicSettingsData]: AcademicSettingsData[K] extends string ? K : never }[keyof AcademicSettingsData];
import { Platform, PluginSettingTab, Setting } from 'obsidian';
class AcademicSettings extends PluginSettingTab {
    plugin: AcademicNotes;
    appearanceType = 'thm';
    constructor(app: App, plugin: AcademicNotes) { super(app, plugin); this.plugin = plugin; }
    display() { this.refreshSettings(); }
    refreshSettings() {
        this.containerEl.empty();
        for (const definition of this.getSettingDefinitions()) {
            const setting = new Setting(this.containerEl).setName(definition.name).setDesc(definition.desc || '');
            definition.render(setting);
        }
    }
    async changeAppearance(field: keyof AppearanceEntry, value: string) {
        const all = parseAppearance(this.plugin.settings.customAppearance);
        const entry = all[this.appearanceType] || {};
        if (value) entry[field] = value; else delete entry[field];
        all[this.appearanceType] = entry;
        this.plugin.settings.customAppearance = JSON.stringify(all);
        await this.plugin.saveSettings();
    }
    renderAppearance(container: HTMLElement) {
        const root = container.createDiv({ cls: 'an-appearance-settings' });
        new Setting(root).setName(t('环境自定义')).setHeading();
        new Setting(root).setName(t('选择环境')).setDesc(t('每类环境独立设置；关闭颜色开关即恢复当前色板。')).addDropdown(d => d.addOptions(Object.fromEntries(Object.entries(Engine.TYPES).map(([key, names]) => [key, names[0]]))).setValue(this.appearanceType).onChange(value => { this.appearanceType = value; this.refreshSettings(); }));
        const entry = parseAppearance(this.plugin.settings.customAppearance)[this.appearanceType] || {};
        const colors: [keyof AppearanceEntry, string, string][] = [
            ['light', t('浅色模式主色'), '#286b76'], ['dark', t('深色模式主色'), '#8dc8d0']
        ];
        const plain = ['proof', 'remark'].includes(this.appearanceType);
        if (!plain) colors.push(['motifLight', t('浅色模式角标颜色'), '#286b76'], ['motifDark', t('深色模式角标颜色'), '#8dc8d0']);
        for (const [field, name, fallback] of colors) {
            const row = new Setting(root).setName(name).setDesc(entry[field] || t('跟随默认配色'));
            row.addToggle(c => c.setValue(!!entry[field]).onChange(async enabled => { await this.changeAppearance(field, enabled ? fallback : ''); this.refreshSettings(); }));
            row.addColorPicker(c => c.setValue(entry[field] || fallback).setDisabled(!entry[field]).onChange(async value => { await this.changeAppearance(field, value); row.setDesc(value); }));
        }
        const names = { laurel: t('月桂'), compass: t('罗盘'), rosette: t('花章'), orbit: t('轨道'), lattice: t('晶格'), knot: t('编结'), arch: t('拱廊'), quill: t('羽笔'), folio: t('书页') };
        if (!plain) {
            new Setting(root).setName(t('角标图案')).addDropdown(d => d.addOptions({ default: t('原有图案'), none: t('无角标'), ...names }).setValue(entry.motif || 'default').onChange(async value => { await this.changeAppearance('motif', value === 'default' ? '' : value); this.refreshSettings(); }));
            const gallery = root.createDiv({ cls: 'an-motif-gallery' });
            for (const id of Object.keys(MOTIFS) as (keyof typeof MOTIFS)[]) {
                const button = gallery.createEl('button', { attr: { 'aria-label': names[id], 'aria-pressed': String(entry.motif === id) } });
                const symbol = button.createSpan({ cls: 'an-motif-sample', attr: { 'aria-hidden': 'true' } });
                symbol.style.setProperty('--an-preview-mask', motifMask(id));
                button.createSpan({ text: names[id] });
                button.addEventListener('click', () => { void this.changeAppearance('motif', id).then(() => this.refreshSettings()); });
            }
        }
        root.createEl('p', { text: plain ? t('Proof 与 Remark 保持无框段落；自定义主色只改变标题，Proof 的结束方框保持不变。') : t('主色同步用于标题底色、边框和浅色同色系背景；标题文字自动选择黑色或白色。角标默认跟随主色。') });
        const preview = root.createDiv({ cls: 'markdown-rendered an-appearance-preview' });
        const callout = preview.createDiv({ cls: 'callout', attr: { 'data-callout': this.appearanceType } });
        callout.createDiv({ cls: 'callout-title' }).createDiv({ cls: 'callout-title-inner', text: Engine.TYPES[this.appearanceType][0] });
        callout.createDiv({ cls: 'callout-content' }).createEl('p', { text: t('这是当前模式下的外观预览。') });
        new Setting(root).setName(t('恢复此环境默认外观')).addButton(b => b.setButtonText(t('恢复默认')).onClick(async () => {
            const all = parseAppearance(this.plugin.settings.customAppearance); delete all[this.appearanceType];
            this.plugin.settings.customAppearance = JSON.stringify(all); await this.plugin.saveSettings(); this.refreshSettings();
        }));
        root.createEl('p', { text: t('边框粗细、圆角、角标大小与透明度可在 Style Settings → Academic Notes 调整；圆角 0 为直角。') });
    }
    getSettingDefinitions() {
        const definitions: { name: string; desc?: string; render: (setting: Setting) => void }[] = [];
        const p = this.plugin, s = p.settings;
        const toggle = (key: BooleanKey, name: string, desc = '') => definitions.push({ name, desc, render: row => { row.addToggle(t => t.setValue(s[key]).onChange(async v => { s[key] = v; await p.saveSettings(); })); } });
        const text = (key: StringKey, name: string, desc = '') => definitions.push({ name, desc, render: row => { row.addText(t => t.setValue(s[key]).onChange(async v => { s[key] = v; await p.saveSettings(); })); } });
        const select = (key: StringKey | 'tocDepth', name: string, options: Record<string, string>, desc = '') => definitions.push({ name, desc, render: row => { row.addDropdown(d => d.addOptions(options).setValue(String(s[key])).onChange(async v => { if (key === 'tocDepth') s.tocDepth = Number(v); else s[key] = v; await p.saveSettings(); })); } });
        const heading = (name: string) => definitions.push({ name, render: row => { row.setHeading(); } });
        const description = (desc: string) => definitions.push({ name: '', desc, render: () => {} });
        heading(t("编号与引用"));
        toggle('numbered', t("定理类环境自动编号"), t("Proof、Remark、Solution 默认不计数。"));
        select('equationMode', t("公式自动编号"), { referenced: t("仅被引用的公式（全库判断）"), all: t("所有独立公式块"), none: t("关闭自动编号") }, t("保留显式 \\tag；只有进入自动编号的公式才增加计数器。"));
        select('numbering', t("笔记内编号范围"), { section: t("按 H2 分节重置"), file: t("整篇连续编号") });
        toggle('sectionPrefix', t("编号前加入 H2 节号"), t("分节模式下：开启为 Theorem 2.1；关闭仍在每个 H2 重置，但只显示 Theorem 1。"));
        select('sectionNumberSource', t("H2 节号来源"), { order: t("按 H2 出现顺序：1、2、3"), heading: t("优先使用标题开头的数字") }, t("只读源码中的 H2，不计 H3、H6 或代码块里的标题。"));
        toggle('shortReferences', t("链接引用使用缩写"), t("标题仍为 Theorem / Definition；链接显示 thm 2.1 / def 2.1。"));
        toggle('mediaNumbered', t("图、表和子图自动编号"), t("用 [!figure] / [!table]；嵌套 [!subfigure] 得到 (a)、(b)。安装后即可使用内置图表样式。"));
        toggle('sharedCounter', t("不同定理类型共享计数器"), t("关闭时 Definition、Theorem 等各自计数。公式始终独立。"));
        text('numberPrefix', t("编号前缀"), t("留空不会从日期文件名推断章节号。"));
        text('eqFormat', t("公式引用格式"), t("支持 {number}、{file}；默认 eq:{number}，也可设 Eq. ({number})。"));
        text('theoremFormat', t("定理引用格式"), t("支持 {type}、{number}、{title}、{file}；{abbr} 始终缩写，{name} 始终全称。"));
        toggle('respectAliases', t("保留手写链接别名"), t("[[#^id|自己的文字]] 不被自动编号替换，但仍算引用。"));
        toggle('livePreview', t("在实时预览中转换链接与编号"), t("光标进入链接时恢复源码。源码模式不进行显示替换。"));
        text('excludedFolders', t("排除索引的路径"), t("多个目录/文件请用换行分隔；也可直接编辑本插件 data.json。"));
        heading(t("独立配色"));
        select('lightPalette', t("浅色数学框配色"), { theme: t("跟随 Obsidian 主题配色"), forest: 'Forest', sakura: 'Sakura', mint: 'Mint', sky: 'Sky', mauve: 'Mauve', golden: 'Golden', cherry: 'Cherry', prussian: 'Prussian' });
        select('darkPalette', t("深色数学框配色"), { theme: t("跟随 Obsidian 主题配色"), radiation: 'Radiation', vampire: 'Vampire', abyss: 'Abyss' });
        description(t("跟随主题读取 Obsidian 的强调色、蓝/紫/绿/青/橙色及正文色，不匹配预设色板，也不直接读取操作系统主色调。固定色板不受主题配色切换影响；浅深模式跟随 Obsidian。"));
        toggle('neutralBody', t("框内正文使用普通正文色"), t("开启：正文与笔记普通文字同色；关闭：正文混入 36% 的当前框色。只改变正文，不改变标题、边框和底色。"));
        toggle('hideMotif', t("隐藏右下角小图案"));
        heading(t("目录与 PDF"));
        description(Platform.isDesktopApp ? t("PDF 使用 Obsidian 自带的 Electron 引擎，无需安装 Python 或外部浏览器。") : t('移动端可使用编号、引用、样式和 HTML 快照；PDF 导出仅在桌面版可用。'));
        select('tocDepth', t("目录层级"), { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6' });
        select('exportNumbering', t("合订本编号"), { 'chapter-section': t("章.节.序号（如 2.3.1）"), chapter: t("章.序号（如 2.1，章内连续）"), note: t("保留库内显示编号（可能跨章重号）") }, t("前两种按入选章节重新编号和解析引用；保留模式沿用全库编号。原笔记不改写。"));
        text('exportFolder', t("导出目录"), t("库内相对路径，默认 _exports。"));
        toggle('captureTheme', t("PDF 捕获当前主题与片段样式"), t("关闭时使用插件自己的数学框与基础排版。"));
        if (Platform.isDesktopApp) toggle('openPdf', t("生成后在 Obsidian 打开 PDF"));
        definitions.push({ name: '', render: setting => { setting.settingEl.addClass('an-custom-appearance-row'); this.renderAppearance(setting.settingEl); } });
        return definitions;
    }
}
export { AcademicSettings };
