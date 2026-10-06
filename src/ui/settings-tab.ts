import { renderEnvironmentSettings } from './environment-settings';
import { t } from '../i18n';
import Engine from '../indexing/engine';
import { MOTIFS, motifMask, titleInk, type AppearanceEntry } from '../rendering/custom-appearance';
import { paletteOptions, selectedPalette, paletteOverrides, defaultRoleColor, defaultRoleValue, customPalettes, basePalette, appearanceRoles, type PaletteMode } from '../rendering/palettes';
import type AcademicNotes from '../main';
import type { App, SettingDefinitionItem } from 'obsidian';
import type { AcademicSettingsData } from '../settings';
type BooleanKey = { [K in keyof AcademicSettingsData]: AcademicSettingsData[K] extends boolean ? K : never }[keyof AcademicSettingsData];
type StringKey = { [K in keyof AcademicSettingsData]: AcademicSettingsData[K] extends string ? K : never }[keyof AcademicSettingsData];
import { Platform, PluginSettingTab, Setting, Notice } from 'obsidian';
class AcademicSettings extends PluginSettingTab {
    plugin: AcademicNotes;
    appearanceType = 'thm';
    section = 'environment';
    paletteHost?: HTMLElement;
    appearanceHost?: HTMLElement;
    appearanceMode: PaletteMode = typeof document !== 'undefined' && document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    constructor(app: App, plugin: AcademicNotes) { super(app, plugin); this.plugin = plugin; }
    // Obsidian 1.13+ bypasses display() when this public hook is nonempty.
    // Keep our grouped editor on the imperative path, including older hosts.
    getSettingDefinitions(): SettingDefinitionItem[] { return []; }
    display() { this.refreshSettings(); }
    refreshSettings() {
        this.containerEl.empty();
        this.appearanceHost = undefined;
        this.paletteHost = this.containerEl.createDiv({ cls: 'an-overall-palette' });
        this.renderPalette(this.paletteHost);
        const navigation = this.containerEl.createDiv({ cls: 'an-settings-tabs', attr: { role: 'tablist', 'aria-label': t('插件设置') } });
        const panel = this.containerEl.createDiv({ cls: 'an-settings-panel', attr: { role: 'tabpanel', id: 'an-settings-panel' } });
        const sections = { environment: t('环境'), numbering: t('编号与引用默认值'), typography: t('段落排版'), export: t('目录与导出') };
        for (const [key, name] of Object.entries(sections)) {
            const button = navigation.createEl('button', { text: name, attr: { role: 'tab', 'aria-controls': 'an-settings-panel', 'aria-selected': String(key === this.section), tabindex: key === this.section ? '0' : '-1', id: 'an-settings-'+key, 'data-an-section': key } });
            button.addEventListener('click', () => { this.section = key; this.refreshSettings(); this.containerEl.querySelector<HTMLButtonElement>(`[data-an-section="${key}"]`)?.focus({preventScroll:true}); });
        }
        panel.setAttribute('aria-labelledby','an-settings-'+this.section);
        navigation.addEventListener('keydown', event => {
            if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
            const keys=Object.keys(sections), current=keys.indexOf(this.section), index=event.key==='Home'?0:event.key==='End'?keys.length-1:(current+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
            event.preventDefault(); navigation.querySelector<HTMLButtonElement>(`[data-an-section="${keys[index]}"]`)?.click();
        });
        const definitions = this.buildSettingRows();
        const render = (parent: HTMLElement, group: string) => {
            for (const definition of definitions.filter(definition => definition.group === group)) {
                const setting = new Setting(parent).setName(definition.name).setDesc(definition.desc || ''); definition.render(setting);
            }
        };
        if (this.section === 'environment') {
            renderEnvironmentSettings(panel, this.plugin, {
                selected: this.appearanceType,
                onSelect: key => { this.appearanceType = key; this.appearanceHost = undefined; },
                renderAppearance: parent => {
                    this.appearanceHost = parent.createDiv({ cls: 'an-custom-appearance-row' });
                    this.renderAppearance(this.appearanceHost);
                }
            });
            const details = panel.createEl('details', { cls: 'an-settings-details' });
            details.createEl('summary', { text: t('通用外观选项') }); render(details, 'appearance');
        } else if (this.section === 'numbering') {
            render(panel, 'numbering');
            new Setting(panel).setName(t('引用默认格式与索引')).setHeading(); render(panel, 'references');
        } else render(panel, this.section);
    }
    async changeAppearance(field: keyof AppearanceEntry, value: string) {
        const all = paletteOverrides(this.plugin.settings), key = selectedPalette(this.plugin.settings, this.appearanceMode);
        const profile = all[key] || {}, entry = profile[this.appearanceType] || {};
        if (value) entry[field] = value; else delete entry[field];
        profile[this.appearanceType] = entry; all[key] = profile;
        this.plugin.settings.paletteAppearance = JSON.stringify(all);
        await this.plugin.saveSettings();
    }
    refreshAppearance(container: HTMLElement) { this.replaceSection(container, parent => this.renderAppearance(parent)); }
    replaceSection(container: HTMLElement, render: (parent: HTMLElement) => void) {
        const positions: [HTMLElement, number][] = [];
        for (let node: HTMLElement | null = container; node; node = node.parentElement)
            if (node.scrollTop) positions.push([node, node.scrollTop]);
        const focused = container.ownerDocument.activeElement as HTMLElement | null;
        const control = focused?.dataset.anControl;
        const restoreFocus = focused?.tagName !== 'SELECT';
        if (!restoreFocus) focused?.blur();
        const staging = container.ownerDocument.win.createDiv(); render(staging);
        container.replaceChildren(...staging.childNodes);
        if (control && restoreFocus) container.querySelector<HTMLElement>(`[data-an-control="${control}"]`)?.focus({ preventScroll: true });
        for (const [node, top] of positions) node.scrollTop = top;
    }
    refreshPalette() {
        if (this.paletteHost) this.replaceSection(this.paletteHost, parent => this.renderPalette(parent));
        if (this.appearanceHost) this.refreshAppearance(this.appearanceHost);
    }
    paletteLabels(mode: PaletteMode): Record<string,string> {
        return { ...paletteOptions(this.plugin.settings, mode), theme: t('跟随主题主色'),
            ...(mode === 'light' ? { colorful: t('彩色') } : { 'colorful-dark': t('彩色') }), 'new-custom': t('新建自定义色板…') };
    }
    renderPalette(container: HTMLElement) {
        const root = container.createDiv({ cls: 'an-palette-settings' }), settings = this.plugin.settings;
        new Setting(root).setName(t('整体配色')).setHeading();
        root.createEl('p', { cls: 'an-settings-intro', text: t('先选整套配色，再在环境中调整引用、颜色和图标。浅色和深色各保存一套，随 Obsidian 明暗模式切换。') });
        for (const mode of ['light', 'dark'] as const) {
            const field = mode === 'light' ? 'lightPalette' : 'darkPalette';
            new Setting(root).setName(t(mode === 'light' ? '浅色配色' : '深色配色')).addDropdown(d => {
                d.selectEl.dataset.anControl = field;
                d.addOptions(this.paletteLabels(mode)).setValue(selectedPalette(settings, mode)).onChange(async value => {
                    d.selectEl.blur(); this.appearanceMode = mode;
                    if (value === 'new-custom') {
                        this.refreshPalette();
                        const management=this.paletteHost?.querySelector<HTMLDetailsElement>('.an-palette-management');
                        if (management) { management.open=true; management.querySelector<HTMLInputElement>('input[type=text]')?.focus({preventScroll:true}); }
                        return;
                    }
                    settings[field] = value;
                    await this.plugin.saveSettings(); this.refreshPalette();
                });
            });
        }
        new Setting(root).setName(t('当前编辑的色板')).addDropdown(d => {
            d.selectEl.dataset.anControl = 'mode';
            d.addOptions({ light: t('浅色'), dark: t('深色') }).setValue(this.appearanceMode).onChange(value => {
                d.selectEl.blur(); this.appearanceMode = value as PaletteMode; this.refreshPalette();
            });
        });
        const palette = selectedPalette(settings, this.appearanceMode);
        const activeMode: PaletteMode = typeof document !== 'undefined' && document.body.classList.contains('theme-dark') ? 'dark' : 'light';
        root.createEl('p', { cls: 'an-palette-status', text: t('正在编辑：{0} · {1}。笔记当前使用：{2} · {3}。', t(this.appearanceMode === 'light' ? '浅色' : '深色'), this.paletteLabels(this.appearanceMode)[palette], t(activeMode === 'light' ? '浅色' : '深色'), this.paletteLabels(activeMode)[selectedPalette(settings, activeMode)]) });
        const overview = root.createDiv({ cls: 'an-palette-overview' }), profile = paletteOverrides(settings)[palette] || {};
        for (const role of ['def','thm','lem','prop','cor','claim','example','algorithm']) {
            const swatch = overview.createDiv({ cls: 'an-palette-swatch', attr: { 'data-an-swatch': role } });
            swatch.style.setProperty('--an-swatch-color', profile[role]?.[this.appearanceMode] || defaultRoleValue(settings,palette,role,this.appearanceMode));
            swatch.createSpan({ text: Engine.labelName(role,settings) });
        }
        const management = root.createEl('details', { cls: 'an-settings-details an-palette-management' });
        management.createEl('summary', { text: t('自定义色板与恢复默认') });
        let name = '';
        new Setting(management).setName(t('复制为自定义色板')).setDesc(t('复制当前色板及其环境覆盖；新色板可独立编辑和恢复默认。')).addText(c => c.setPlaceholder(t('色板名称')).onChange(value => { name=value.trim(); })).addButton(b => b.setButtonText(t('创建色板')).onClick(async () => {
            const all=customPalettes(settings.customPalettes);
            if (!name || Object.keys(all).length >= 32) { new Notice(t('请填写色板名称；最多 32 个自定义色板。')); return; }
            let key='custom-'+Date.now().toString(36); while(Object.hasOwn(all,key)) key+='x';
            all[key]={name,mode:this.appearanceMode,base:basePalette(settings,palette)};
            settings.customPalettes=JSON.stringify(all);
            const overrides=paletteOverrides(settings); overrides[key]=structuredClone(overrides[palette] || {});
            settings.paletteAppearance=JSON.stringify(overrides);
            settings[this.appearanceMode==='dark'?'darkPalette':'lightPalette']=key;
            await this.plugin.saveSettings(); this.refreshPalette();
        }));
        new Setting(management).setName(t('恢复整套色板默认值')).setDesc(t('只清除当前色板的所有环境覆盖，其他色板不变。')).addButton(b => {
            b.buttonEl.dataset.anControl='resetPalette'; b.setButtonText(t('恢复默认')).onClick(async () => {
                const all=paletteOverrides(settings); delete all[palette]; settings.paletteAppearance=JSON.stringify(all);
                await this.plugin.saveSettings(); this.refreshPalette();
            });
        });
        const custom=customPalettes(settings.customPalettes)[palette];
        if (custom) new Setting(management).setName(t('删除当前自定义色板')).addButton(b => b.setButtonText(t('删除色板')).onClick(async () => {
            const all=customPalettes(settings.customPalettes), overrides=paletteOverrides(settings); delete all[palette]; delete overrides[palette];
            settings.customPalettes=JSON.stringify(all); settings.paletteAppearance=JSON.stringify(overrides);
            settings[this.appearanceMode==='dark'?'darkPalette':'lightPalette']=custom.base;
            await this.plugin.saveSettings(); this.refreshPalette();
        }));
    }
    renderAppearance(container: HTMLElement) {
        const root = container.createDiv({ cls: 'an-appearance-settings' }), settings = this.plugin.settings;
        const redraw = () => { if (root.parentElement) this.refreshAppearance(root.parentElement); };
        if (!Object.hasOwn(appearanceRoles(settings), this.appearanceType)) {
            root.createEl('p', { text: t('此环境保持图表或公式的原生排版；引用名称和格式可在上方调整。') }); return;
        }
        new Setting(root).setName(t('颜色与图标')).setHeading();
        root.createEl('p', { cls: 'an-settings-intro', text: t('颜色可直接修改，自动保存到当前色板。名称与引用修改后点击保存。') });
        const palette = selectedPalette(settings,this.appearanceMode), profiles = paletteOverrides(settings);
        const updateOverview = () => {
            if (this.paletteHost) this.replaceSection(this.paletteHost, parent => this.renderPalette(parent));
        };
        const entry = profiles[palette]?.[this.appearanceType] || {};
        const field = this.appearanceMode, motifField = field === 'light' ? 'motifLight' : 'motifDark';
        const fallback = defaultRoleColor(settings,palette,this.appearanceType,this.appearanceMode);
        const fallbackValue = defaultRoleValue(settings,palette,this.appearanceType,this.appearanceMode);
        const plain = ['proof', 'remark', 'algorithm'].includes(this.appearanceType) || Engine.environments(settings)[this.appearanceType]?.style === 'remark';
        const colors: [keyof AppearanceEntry,string,string][] = [[field,t('环境主色'),fallback]];
        if (!plain) colors.push([motifField,t('角标颜色'),entry[field] || fallback]);
        for (const [colorField,name,defaultColor] of colors) {
            const row = new Setting(root).setName(name).setDesc(entry[colorField] || t('跟随当前色板默认值'));
            row.addColorPicker(c => c.setValue(entry[colorField] || defaultColor).onChange(async value => { await this.changeAppearance(colorField,value); row.setDesc(value); updatePreview(); updateOverview(); }));
            row.settingEl.querySelector<HTMLInputElement>('input[type=color]')!.dataset.anControl = colorField;
            row.addButton(b => { b.buttonEl.dataset.anControl = 'reset-'+colorField; b.setButtonText(t('默认')).onClick(async () => { await this.changeAppearance(colorField,''); redraw(); updateOverview(); }); });
        }
        const names = { laurel:t('月桂'), compass:t('罗盘'), rosette:t('花章'), orbit:t('轨道'), lattice:t('晶格'), knot:t('编结'), arch:t('拱廊'), quill:t('羽笔'), folio:t('书页') };
        if (!plain) {
            new Setting(root).setName(t('角标图案')).addDropdown(d => { d.selectEl.dataset.anControl = 'motif'; d.addOptions({ default:t('原有图案'), none:t('无角标'), ...names }).setValue(entry.motif || 'default').onChange(async value => { await this.changeAppearance('motif',value === 'default' ? '' : value); redraw(); }); });
            const gallery = root.createDiv({cls:'an-motif-gallery'});
            for (const id of Object.keys(MOTIFS) as (keyof typeof MOTIFS)[]) {
                const button = gallery.createEl('button',{attr:{'aria-label':names[id],'aria-pressed':String(entry.motif===id),'data-an-control':id}});
                button.createSpan({cls:'an-motif-sample',attr:{'aria-hidden':'true'}}).style.setProperty('--an-preview-mask',motifMask(id));
                button.createSpan({text:names[id]}); button.addEventListener('click',()=>{void this.changeAppearance('motif',id).then(redraw);});
            }
        }
        root.createEl('p',{text:this.appearanceType==='algorithm'?t('算法使用三线样式；主色改变线条和标题，正文保持中性色。'):plain?t('Proof 与 Remark 保持无框段落；自定义主色只改变标题，Proof 的结束方框保持不变。'):t('主色同步用于标题底色、边框和浅色同色系背景；标题文字自动选择黑色或白色。角标默认跟随主色。')});
        const preview = root.createDiv({cls:'markdown-rendered an-appearance-preview'}), custom = Engine.environments(settings)[this.appearanceType];
        const box = preview.createDiv({cls:'callout' + (custom?' an-custom-environment':''),attr:{'data-callout':this.appearanceType}});
        if(custom) box.dataset.anStyle=custom.style;
        const updatePreview=()=>{
            const current=paletteOverrides(settings)[palette]?.[this.appearanceType] || {};
            box.style.setProperty('--phb-surface',field==='dark'?'#18181b':'#ffffff');
            box.style.setProperty('--phb-tint',field==='dark'?'8%':'6%');
            const activeMode = typeof document !== 'undefined' && document.body.classList.contains('theme-dark') ? 'dark' : 'light';
            box.style.setProperty('--text-normal',field===activeMode?'inherit':field==='dark'?'#e5e7eb':'#24372e');
            box.style.setProperty('--an-ink-'+this.appearanceType,titleInk(current[field] || fallback));
            box.style.setProperty('--an-motif-color-'+this.appearanceType,current[motifField] || current[field] || fallbackValue);
            box.style.setProperty('--phb-accent',current[field] || fallbackValue);box.style.setProperty('--phb-badge-ink',titleInk(current[field] || fallback));
            box.style.setProperty('--an-algorithm-accent',current[field] || fallbackValue);
            // Shadow the active profile so an inactive-mode preview cannot
            // inherit a different palette's overrides from the document body.
            box.style.setProperty('--an-color-'+this.appearanceType,current[field] || 'initial');
            box.style.setProperty('--an-symbol-'+this.appearanceType,current.motif?motifMask(current.motif):'initial');
            box.style.setProperty('--an-motif-display-'+this.appearanceType,current.motif?(current.motif==='none'?'none':'block'):'initial');
            box.style.setProperty('--phb-symbol',current.motif?motifMask(current.motif):'var(--an-original-symbol, none)');
            box.style.setProperty('--an-motif-display',current.motif?(current.motif==='none'?'none':'block'):custom?'none':'block');
            if(this.appearanceType==='remark' || custom?.style==='remark')box.style.setProperty('--an-remark-color',`color-mix(in srgb, ${fallbackValue} ${field==='dark'?'80%':'98%'}, white)`);
            if(custom){box.style.setProperty('--an-custom-palette-color',current[field] || (plain?'var(--an-remark-color)':fallbackValue));box.style.setProperty('--an-custom-palette-ink',titleInk(current[field] || fallback));}

            box.style.setProperty('--phb-motif-color',current[motifField] || current[field] || fallbackValue);
        };
        updatePreview();
        box.createDiv({cls:'callout-title'}).createDiv({cls:'callout-title-inner',text:Engine.typeNames(this.appearanceType,settings)[0]});
        box.createDiv({cls:'callout-content'}).createEl('p',{text:t('这是所选色板的外观预览。')});
        new Setting(root).setName(t('恢复此环境默认外观')).addButton(b => { b.buttonEl.dataset.anControl='reset'; b.setButtonText(t('恢复默认')).onClick(async()=>{
            const all=paletteOverrides(settings), profile=all[palette] || {}; delete profile[this.appearanceType]; all[palette]=profile;
            settings.paletteAppearance=JSON.stringify(all); await this.plugin.saveSettings(); redraw();
        }); });
        root.createEl('p',{text:t('边框粗细、圆角、角标大小与透明度可在 Style Settings → Academic Notes 调整；圆角 0 为直角。')});
    }
    buildSettingRows() {
        let group = 'typography';
        const definitions: { group: string; name: string; desc?: string; render: (setting: Setting) => void }[] = [];
        const p = this.plugin, s = p.settings;
        const toggle = (key: BooleanKey, name: string, desc = '') => definitions.push({ group, name, desc, render: row => { row.addToggle(t => t.setValue(s[key]).onChange(async v => { s[key] = v; await p.saveSettings(); })); } });
        const text = (key: StringKey, name: string, desc = '') => definitions.push({ group, name, desc, render: row => { row.addText(t => t.setValue(s[key]).onChange(async v => { s[key] = v; await p.saveSettings(); })); } });
        const select = (key: StringKey | 'tocDepth' | 'pdfFloatMaxRounds', name: string, options: Record<string, string>, desc = '') => definitions.push({ group, name, desc, render: row => { row.addDropdown(d => d.addOptions(options).setValue(String(s[key])).onChange(async v => { if (key === 'tocDepth' || key === 'pdfFloatMaxRounds') s[key] = Number(v); else s[key] = v; await p.saveSettings(); })); } });
        const heading = (name: string) => definitions.push({ group, name, render: row => { row.setHeading(); } });
        const description = (desc: string) => definitions.push({ group, name: '', desc, render: () => {} });
        heading(t('段落排版'));
        toggle('paragraphIndent', t('正文首行缩进两个汉字'), t('阅读、实时预览及导出中的文字段落首行缩进 2em；不写入空格，默认关闭。标题、列表、代码、图注和表格不缩进。'));
        heading(t('Knuth–Plass 断行（Beta）'));
        toggle('kpReading', t('阅读视图使用 Knuth–Plass 断行'), t('整段优化正文及数学环境的断行和间距；窗口宽度变化后重新排版。默认关闭，实时预览与源码不受影响。'));
        toggle('kpLivePreview', t('实时预览使用 Knuth–Plass 断行'), t('优化未编辑的单行普通段落和只读数学环境正文；环境内支持公式和链接。光标或选区进入时恢复原生排版，编辑标题时保持原生。默认关闭。'));
        if (Platform.isDesktopApp) toggle('kpPdf', t('PDF 使用 Knuth–Plass 断行'), t('在最终打印宽度下重新排版正文及数学环境；HTML 快照保留浏览器排版。'));
        description(t('支持 Proof、Remark、定理等环境及首行缩进，保留标题、公式和证明结束方框。实时预览中正在编辑的段落使用原生两端对齐；未编辑的只读环境可使用 KP。列表、图片、显式换行和不支持或过长的内容使用浏览器排版；暂不自动断词。'));
        group = 'numbering';
        toggle('numbered', t("定理类环境自动编号"), t("Proof、Remark、Solution 默认不计数。"));
        select('equationMode', t("公式自动编号"), { referenced: t("仅被引用的公式（全库判断）"), all: t("所有独立公式块"), none: t("关闭自动编号") }, t("保留显式 \\tag；只有进入自动编号的公式才增加计数器。"));
        select('numbering', t("笔记内编号范围"), { section: t("按 H2 分节重置"), file: t("整篇连续编号") });
        toggle('sectionPrefix', t("编号前加入 H2 节号"), t("分节模式下：开启为 Theorem 2.1；关闭仍在每个 H2 重置，但只显示 Theorem 1。"));
        select('sectionNumberSource', t("H2 节号来源"), { order: t("按 H2 出现顺序：1、2、3"), heading: t("优先使用标题开头的数字") }, t("只读源码中的 H2，不计 H3、H6 或代码块里的标题。"));
        toggle('shortReferences', t("链接引用使用缩写"), t("标题仍为 Theorem / Definition；链接显示 thm 2.1 / def 2.1。"));
        toggle('mediaNumbered', t("图、表和子图自动编号"), t("用 [!figure] / [!table]；嵌套 [!subfigure] 得到 (a)、(b)。安装后即可使用内置图表样式。"));
        toggle('sharedCounter', t("不同定理类型共享计数器"), t("关闭时 Definition、Theorem 等各自计数。公式始终独立。"));
        toggle('algorithmNumbered', t('算法自动编号'), t('代码块与 Callout 共用独立计数器，遵循当前分节或整篇编号设置。'));
        toggle('algorithmLineNumbers', t('显示算法行号'), t('这是所有算法的行号总开关；关闭时即使源码写了 lines=true 也不显示。开启后可用 lines=false 单独关闭；输入、输出和注释不计行号。'));
        group = 'numbering';
        text('numberPrefix', t("编号前缀"), t("留空不会从日期文件名推断章节号。"));
        group = 'references';
        text('theoremFormat', t('定理类环境的默认引用格式'), t('仅用于未单独设置格式的定理、定义、引理等环境；图、表、算法和公式请在上方选择环境后设置。'));
        toggle('respectAliases', t("保留手写链接别名"), t("[[#^id|自己的文字]] 不被自动编号替换，但仍算引用。"));
        toggle('livePreview', t("在实时预览中转换链接与编号"), t("光标进入链接时恢复源码。源码模式不进行显示替换。"));
        text('excludedFolders', t("排除索引的路径"), t("多个目录/文件请用换行分隔；也可直接编辑本插件 data.json。"));
        group = 'appearance';
        toggle('neutralBody', t("框内正文使用普通正文色"), t("开启：正文与笔记普通文字同色；关闭：正文混入 36% 的当前框色。只改变正文，不改变标题、边框和底色。"));
        toggle('hideMotif', t("隐藏右下角小图案"));
        group = 'export';
        description(Platform.isDesktopApp ? t("PDF 使用 Obsidian 自带的 Electron 引擎，无需安装 Python 或外部浏览器。") : t('移动端可使用编号、引用、样式和 HTML 快照；PDF 导出仅在桌面版可用。'));
        select('tocDepth', t("目录层级"), { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6' });
        select('exportNumbering', t("合订本编号"), { 'chapter-section': t("章.节.序号（如 2.3.1）"), chapter: t("章.序号（如 2.1，章内连续）"), note: t("保留库内显示编号（可能跨章重号）") }, t("前两种按入选章节重新编号和解析引用；保留模式沿用全库编号。原笔记不改写。"));
        text('exportFolder', t("导出目录"), t("库内相对路径，默认 _exports。"));
        toggle('captureTheme', t("PDF 捕获当前主题与片段样式"), t("关闭时使用插件自己的数学框与基础排版。"));
        if (Platform.isDesktopApp) {
            select('pdfFloatMode', t('图片排版优先级（实验）'), { off: t('直接留白（关闭）'), 'shrink-move': t('缩至 80% → 浮动 → 留白'), 'move-shrink': t('浮动 → 缩至 80% → 留白'), shrink: t('仅缩至 80%，否则留白'), move: t('仅浮动，否则留白') }, t('只调整 PDF 副本中的独立 figure。浮动最多提前三段普通正文，不跨标题、列表或数学环境，不把图片移入环境。调整后以实际 PDF 验证；无法安全排版则留白。'));
            select('pdfFloatMaxRounds', t('最大图片调整次数'), { '1': '1', '3': '3', '6': '6', '10': '10' }, t('整次导出最多尝试这些次数；需要更多尝试时撤销全部实验调整并保留留白。目录校准次数单独计算。'));
        }
        if (Platform.isDesktopApp) toggle('openPdf', t("生成后在 Obsidian 打开 PDF"));
        return definitions;
    }
}
export { AcademicSettings };
