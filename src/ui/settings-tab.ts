import { PluginSettingTab, Setting } from 'obsidian';
class AcademicSettings extends PluginSettingTab {
    [key: string]: any;
    constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
    display() {
        const el = this.containerEl;
        el.empty();
        const p = this.plugin, s = p.settings;
        el.createEl('p', { text: '编号、块引用和 PDF 命令不依赖特定主题或其他编号插件。请避免同时启用多个编号插件或重复的数学框 CSS。' });
        const toggle = (key, name, desc = "") => new Setting(el).setName(name).setDesc(desc || '').addToggle(t => t.setValue(!!s[key]).onChange(async (v) => { s[key] = v; await p.saveSettings(); }));
        const text = (key, name, desc = "") => new Setting(el).setName(name).setDesc(desc || '').addText(t => t.setValue(String(s[key] || '')).onChange(async (v) => { s[key] = v; await p.saveSettings(); }));
        const select = (key, name, options: Record<string, string>, desc = "") => new Setting(el).setName(name).setDesc(desc || '').addDropdown(d => { for (const [k, v] of Object.entries(options))
            d.addOption(k, v); d.setValue(String(s[key])).onChange(async (v) => { s[key] = key === 'tocDepth' ? Number(v) : v; await p.saveSettings(); }); });
        el.createEl('h3', { text: '编号与引用' });
        toggle('numbered', '定理类环境自动编号', 'Proof、Remark、Solution 默认不计数。');
        select('equationMode', '公式自动编号', { referenced: '仅被引用的公式（全库判断）', all: '所有独立公式块', none: '关闭自动编号' }, '保留显式 \\tag；只有进入自动编号的公式才增加计数器。');
        select('numbering', '笔记内编号范围', { section: '按 H2 分节重置', file: '整篇连续编号' });
        toggle('sectionPrefix', '编号前加入 H2 节号', '分节模式下：开启为 Theorem 2.1；关闭仍在每个 H2 重置，但只显示 Theorem 1。');
        select('sectionNumberSource', 'H2 节号来源', { order: '按 H2 出现顺序：1、2、3', heading: '优先使用标题开头的数字' }, '只读源码中的 H2，不计 H3、H6 或代码块里的标题。');
        toggle('shortReferences', '链接引用使用缩写', '标题仍为 Theorem / Definition；链接显示 thm 2.1 / def 2.1。');
        toggle('mediaNumbered', '图、表和子图自动编号', '用 [!figure] / [!table]；嵌套 [!subfigure] 得到 (a)、(b)。安装后即可使用内置图表样式。');
        toggle('sharedCounter', '不同定理类型共享计数器', '关闭时 Definition、Theorem 等各自计数。公式始终独立。');
        text('numberPrefix', '编号前缀', '留空不会从日期文件名推断章节号。');
        text('eqFormat', '公式引用格式', '支持 {number}、{file}；默认 eq:{number}，也可设 Eq. ({number})。');
        text('theoremFormat', '定理引用格式', '支持 {type}、{number}、{title}、{file}；{abbr} 始终缩写，{name} 始终全称。');
        toggle('respectAliases', '保留手写链接别名', '[[#^id|自己的文字]] 不被自动编号替换，但仍算引用。');
        toggle('livePreview', '在实时预览中转换链接与编号', '光标进入链接时恢复源码。源码模式不进行显示替换。');
        text('excludedFolders', '排除索引的路径', '多个目录/文件请用换行分隔；也可直接编辑本插件 data.json。');
        el.createEl('h3', { text: '独立配色' });
        select('lightPalette', '浅色数学框配色', { theme: '跟随 Obsidian 主题配色', forest: 'Forest', sakura: 'Sakura', mint: 'Mint', sky: 'Sky', mauve: 'Mauve', golden: 'Golden', cherry: 'Cherry', prussian: 'Prussian' });
        select('darkPalette', '深色数学框配色', { theme: '跟随 Obsidian 主题配色', radiation: 'Radiation', vampire: 'Vampire', abyss: 'Abyss' });
        el.createEl('p', { text: '跟随主题读取 Obsidian 的强调色、蓝/紫/绿/青/橙色及正文色，不匹配预设色板，也不直接读取操作系统主色调。固定色板不受主题配色切换影响；浅深模式跟随 Obsidian。' });
        toggle('neutralBody', '框内正文使用普通正文色', '开启：正文与笔记普通文字同色；关闭：正文混入 36% 的当前框色。只改变正文，不改变标题、边框和底色。');
        toggle('hideMotif', '隐藏右下角小图案');
        el.createEl('h3', { text: '目录与 PDF' });
        el.createEl('p', { text: 'PDF 使用 Obsidian 自带的 Electron 引擎，无需安装 Python 或外部浏览器。' });
        select('tocDepth', '目录层级', { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6' });
        select('exportNumbering', '合订本编号', { 'chapter-section': '章.节.序号（如 2.3.1）', chapter: '章.序号（如 2.1，章内连续）', note: '保留库内显示编号（可能跨章重号）' }, '前两种按入选章节重新编号和解析引用；保留模式沿用全库编号。原笔记不改写。');
        text('exportFolder', '导出目录', '库内相对路径，默认 _exports。');
        toggle('captureTheme', 'PDF 捕获当前主题与片段样式', '关闭时使用插件自己的数学框与基础排版。');
        toggle('openPdf', '生成后在 Obsidian 打开 PDF');
    }
}
export { AcademicSettings };
