import { renderEnvironmentSettings } from './environment-settings';
import { t } from '../i18n';
import Engine from '../indexing/engine';
import { MOTIFS, motifMask, titleInk, type AppearanceEntry } from '../rendering/custom-appearance';
import { paletteOptions, selectedPalette, paletteOverrides, defaultRoleColor, customPalettes, basePalette, appearanceRoles, type PaletteMode } from '../rendering/palettes';
import type AcademicNotes from '../main';
import type { App } from 'obsidian';
import type { AcademicSettingsData } from '../settings';
type BooleanKey = { [K in keyof AcademicSettingsData]: AcademicSettingsData[K] extends boolean ? K : never }[keyof AcademicSettingsData];
type StringKey = { [K in keyof AcademicSettingsData]: AcademicSettingsData[K] extends string ? K : never }[keyof AcademicSettingsData];
import { Platform, PluginSettingTab, Setting, Notice } from 'obsidian';
class AcademicSettings extends PluginSettingTab {
    plugin: AcademicNotes;
    appearanceType = 'thm';
    section = 'environment';
    appearanceMode: PaletteMode = typeof document !== 'undefined' && document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    constructor(app: App, plugin: AcademicNotes) { super(app, plugin); this.plugin = plugin; }
    display() { this.refreshSettings(); }
    refreshSettings() {
        this.containerEl.empty();
        const navigation = this.containerEl.createDiv({ cls: 'an-settings-tabs', attr: { role: 'tablist', 'aria-label': t('插件设置') } });
        const panel = this.containerEl.createDiv({ cls: 'an-settings-panel', attr: { role: 'tabpanel', id: 'an-settings-panel' } });
        const sections = { environment: t('环境与引用'), appearance: t('配色与外观'), typography: t('段落排版'), export: t('目录与导出') };
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
        const definitions = this.getSettingDefinitions();
        const render = (parent: HTMLElement, group: string) => {
            for (const definition of definitions.filter(definition => definition.group === group)) {
                const setting = new Setting(parent).setName(definition.name).setDesc(definition.desc || ''); definition.render(setting);
            }
        };
        if (this.section === 'environment') {
            renderEnvironmentSettings(panel, this.plugin);
            for (const [group, name] of [['numbering', t('编号规则')], ['references', t('引用默认格式与索引')]]) {
                const details = panel.createEl('details', { cls: 'an-settings-details' }); details.createEl('summary', { text: name }); render(details, group);
            }
        } else if (this.section === 'appearance') {
            render(panel, 'appearance');
            const section = panel.createDiv({ cls: 'an-custom-appearance-row' }); this.renderAppearance(section);
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
    refreshAppearance(container: HTMLElement) {
        const positions: [HTMLElement, number][] = [];
        for (let node: HTMLElement | null = container; node; node = node.parentElement)
            if (node.scrollTop) positions.push([node, node.scrollTop]);
        const focused = container.ownerDocument.activeElement as HTMLElement | null;
        const control = focused?.dataset.anControl;
        // Refocusing a replaced native select can reopen its picker on mobile.
        const restoreFocus = focused?.tagName !== 'SELECT';
        if (!restoreFocus) focused?.blur();
        const staging = container.ownerDocument.win.createDiv();
        this.renderAppearance(staging);
        // Replace only this section, in one operation, without emptying the settings page.
        container.replaceChildren(...staging.childNodes);
        if (control && restoreFocus) container.querySelector<HTMLElement>(`[data-an-control="${control}"]`)?.focus({ preventScroll: true });
        for (const [node, top] of positions) node.scrollTop = top;
    }
    renderAppearance(container: HTMLElement) {
        const root = container.createDiv({ cls: 'an-appearance-settings' }), settings = this.plugin.settings;
        const redraw = () => { if (root.parentElement) this.refreshAppearance(root.parentElement); };
        const options = (mode: PaletteMode) => ({ ...paletteOptions(settings, mode), theme: t('跟随 Obsidian 主题配色') });
        new Setting(root).setName(t('浅色数学框配色')).addDropdown(d => { d.selectEl.dataset.anControl = 'lightPalette'; d.addOptions(options('light')).setValue(settings.lightPalette).onChange(async value => { d.selectEl.blur(); settings.lightPalette = value; this.appearanceMode = 'light'; await this.plugin.saveSettings(); redraw(); }); });
        new Setting(root).setName(t('深色数学框配色')).addDropdown(d => { d.selectEl.dataset.anControl = 'darkPalette'; d.addOptions(options('dark')).setValue(settings.darkPalette).onChange(async value => { d.selectEl.blur(); settings.darkPalette = value; this.appearanceMode = 'dark'; await this.plugin.saveSettings(); redraw(); }); });
        new Setting(root).setName(t('编辑色板模式')).addDropdown(d => { d.selectEl.dataset.anControl = 'mode'; d.addOptions({ light: t('浅色'), dark: t('深色') }).setValue(this.appearanceMode).onChange(value => { this.appearanceMode = value as PaletteMode; redraw(); }); });
        const palette = selectedPalette(settings, this.appearanceMode), profiles = paletteOverrides(settings), roles = appearanceRoles(settings);
        if (!Object.hasOwn(roles, this.appearanceType)) this.appearanceType = 'thm';
        new Setting(root).setName(t('选择环境')).setDesc(t('修改只应用于当前色板；切换色板时恢复该色板自己的颜色。')).addDropdown(d => { d.selectEl.dataset.anControl = 'environment'; d.addOptions(Object.fromEntries(Object.entries(roles).map(([key,names])=>[key,Engine.typeNames(key,settings)[0] || names[0]]))).setValue(this.appearanceType).onChange(value => { this.appearanceType = value; redraw(); }); });
        const entry = profiles[palette]?.[this.appearanceType] || {};
        const field = this.appearanceMode, motifField = field === 'light' ? 'motifLight' : 'motifDark';
        const fallback = defaultRoleColor(settings,palette,this.appearanceType);
        const plain = ['proof', 'remark', 'algorithm'].includes(this.appearanceType) || Engine.environments(settings)[this.appearanceType]?.style === 'remark';
        const colors: [keyof AppearanceEntry,string,string][] = [[field,t('环境主色'),fallback]];
        if (!plain) colors.push([motifField,t('角标颜色'),entry[field] || fallback]);
        for (const [colorField,name,defaultColor] of colors) {
            const row = new Setting(root).setName(name).setDesc(entry[colorField] || t('跟随当前色板默认值'));
            row.addToggle(c => { c.toggleEl.dataset.anControl = colorField; c.setValue(!!entry[colorField]).onChange(async enabled => { await this.changeAppearance(colorField, enabled ? defaultColor : ''); redraw(); }); });
            row.addColorPicker(c => c.setValue(entry[colorField] || defaultColor).setDisabled(!entry[colorField]).onChange(async value => { await this.changeAppearance(colorField,value); row.setDesc(value); updatePreview(); }));
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
            box.style.setProperty('--phb-accent',current[field] || fallback);box.style.setProperty('--phb-badge-ink',titleInk(current[field] || fallback));
            box.style.setProperty('--an-algorithm-accent',current[field] || fallback);
            // Shadow the active profile so an inactive-mode preview cannot
            // inherit a different palette's overrides from the document body.
            box.style.setProperty('--an-color-'+this.appearanceType,current[field] || 'initial');
            box.style.setProperty('--an-symbol-'+this.appearanceType,current.motif?motifMask(current.motif):'initial');
            box.style.setProperty('--an-motif-display-'+this.appearanceType,current.motif?(current.motif==='none'?'none':'block'):'initial');
            box.style.setProperty('--phb-symbol',current.motif?motifMask(current.motif):'var(--an-original-symbol, none)');
            box.style.setProperty('--an-motif-display',current.motif?(current.motif==='none'?'none':'block'):custom?'none':'block');
            if(this.appearanceType==='remark' || custom?.style==='remark')box.style.setProperty('--an-remark-color',`color-mix(in srgb, ${fallback} ${field==='dark'?'80%':'98%'}, white)`);
            if(custom){box.style.setProperty('--an-custom-palette-color',current[field] || (plain?'var(--an-remark-color)':fallback));box.style.setProperty('--an-custom-palette-ink',titleInk(current[field] || fallback));}

            box.style.setProperty('--phb-motif-color',current[motifField] || current[field] || fallback);
        };
        updatePreview();
        box.createDiv({cls:'callout-title'}).createDiv({cls:'callout-title-inner',text:Engine.typeNames(this.appearanceType,settings)[0]});
        box.createDiv({cls:'callout-content'}).createEl('p',{text:t('这是所选色板的外观预览。')});
        new Setting(root).setName(t('恢复此环境默认外观')).addButton(b => { b.buttonEl.dataset.anControl='reset'; b.setButtonText(t('恢复默认')).onClick(async()=>{
            const all=paletteOverrides(settings), profile=all[palette] || {}; delete profile[this.appearanceType]; all[palette]=profile;
            settings.paletteAppearance=JSON.stringify(all); await this.plugin.saveSettings(); redraw();
        }); });
        new Setting(root).setName(t('恢复整套色板默认值')).setDesc(t('只清除当前色板的所有环境覆盖，其他色板不变。')).addButton(b=>{b.buttonEl.dataset.anControl='resetPalette';b.setButtonText(t('恢复默认')).onClick(async()=>{const all=paletteOverrides(settings);delete all[palette];settings.paletteAppearance=JSON.stringify(all);await this.plugin.saveSettings();redraw();});});
        let name='';
        new Setting(root).setName(t('复制为自定义色板')).setDesc(t('复制当前色板及其环境覆盖；新色板可独立编辑和恢复默认。')).addText(c=>c.setPlaceholder(t('色板名称')).onChange(value=>{name=value.trim();})).addButton(b=>b.setButtonText(t('创建色板')).onClick(async()=>{
            const all=customPalettes(settings.customPalettes);if(!name || Object.keys(all).length>=32){new Notice(t('请填写色板名称；最多 32 个自定义色板。'));return;}
            let key='custom-'+Date.now().toString(36);while(Object.hasOwn(all,key))key+='x';
            all[key]={name,mode:this.appearanceMode,base:basePalette(settings,palette)};settings.customPalettes=JSON.stringify(all);
            const overrides=paletteOverrides(settings);overrides[key]=structuredClone(overrides[palette] || {});settings.paletteAppearance=JSON.stringify(overrides);
            if(this.appearanceMode==='dark')settings.darkPalette=key;else settings.lightPalette=key;
            await this.plugin.saveSettings();redraw();
        }));
        const customPalette=customPalettes(settings.customPalettes)[palette];
        if(customPalette) new Setting(root).setName(t('删除当前自定义色板')).addButton(b=>b.setButtonText(t('删除色板')).onClick(async()=>{
            const all=customPalettes(settings.customPalettes),overrides=paletteOverrides(settings);delete all[palette];delete overrides[palette];
            settings.customPalettes=JSON.stringify(all);settings.paletteAppearance=JSON.stringify(overrides);
            if(this.appearanceMode==='dark')settings.darkPalette=customPalette.base;else settings.lightPalette=customPalette.base;
            await this.plugin.saveSettings();redraw();
        }));
        root.createEl('p',{text:t('边框粗细、圆角、角标大小与透明度可在 Style Settings → Academic Notes 调整；圆角 0 为直角。')});
    }
    getSettingDefinitions() {
        let group = 'typography';
        const definitions: { group: string; name: string; desc?: string; render: (setting: Setting) => void }[] = [];
        const p = this.plugin, s = p.settings;
        const toggle = (key: BooleanKey, name: string, desc = '') => definitions.push({ group, name, desc, render: row => { row.addToggle(t => t.setValue(s[key]).onChange(async v => { s[key] = v; await p.saveSettings(); })); } });
        const text = (key: StringKey, name: string, desc = '') => definitions.push({ group, name, desc, render: row => { row.addText(t => t.setValue(s[key]).onChange(async v => { s[key] = v; await p.saveSettings(); })); } });
        const select = (key: StringKey | 'tocDepth' | 'pdfFloatMaxRounds', name: string, options: Record<string, string>, desc = '') => definitions.push({ group, name, desc, render: row => { row.addDropdown(d => d.addOptions(options).setValue(String(s[key])).onChange(async v => { if (key === 'tocDepth' || key === 'pdfFloatMaxRounds') s[key] = Number(v); else s[key] = v; await p.saveSettings(); })); } });
        const heading = (name: string) => definitions.push({ group, name, render: row => { row.setHeading(); } });
        const description = (desc: string) => definitions.push({ group, name: '', desc, render: () => {} });
        heading(t('段落排版（Beta）'));
        toggle('paragraphIndent', t('正文首行缩进两个汉字'), t('阅读、实时预览及导出中的文字段落首行缩进 2em；不写入空格，默认关闭。标题、列表、代码、图注和表格不缩进。'));
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
        toggle('algorithmLineNumbers', t('显示算法行号'), t('行号与算法编号互相独立；输入、输出和注释不计行号。'));
        group = 'references';
        text('algorithmFormat', t('算法引用格式'), t('默认 alg {number}；支持与定理引用相同的占位符。'));
        group = 'numbering';
        text('numberPrefix', t("编号前缀"), t("留空不会从日期文件名推断章节号。"));
        group = 'references';
        text('figureFormat', t('图片引用格式'), t('支持 {type}、{abbr}、{name}、{number}、{title}、{file}。'));
        text('tableFormat', t('表格引用格式'), t('支持 {type}、{abbr}、{name}、{number}、{title}、{file}。'));
        text('eqFormat', t("公式引用格式"), t("支持 {number}、{file}；默认 eq:{number}，也可设 Eq. ({number})。"));
        text('theoremFormat', t("定理引用格式"), t("支持 {type}、{number}、{title}、{file}；{abbr} 始终缩写，{name} 始终全称。"));
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
