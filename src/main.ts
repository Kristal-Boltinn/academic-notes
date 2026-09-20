import * as Obs from 'obsidian';
import { Plugin, Setting, Notice, TFile, MarkdownView, MarkdownRenderer, Component, MarkdownRenderChild, Modal, normalizePath, Platform } from 'obsidian';
import Engine from './indexing/engine';
import DocCore from './export/document';
import { DEFAULTS, type AcademicSettingsData } from './settings';
import { titleRecord, mediaRecord, renderFragment, createLiveExtension, allNodes } from './rendering/adapters';
import { ProgressModal, ReferencePicker, ReferenceSuggest, BookPicker } from './ui/modals';
import { AcademicSettings } from './ui/settings-tab';
import { exportPdf, pdfAvailability } from './export/pdf';
import calloutCss from './styles/callouts.css';
import layoutCss from '../snippets/academic-layout.css';
import documentCss from './styles/document.css';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const jsonSafe = obj => JSON.stringify(obj).replace(/</g, '\\u003c').replace(/&/g, '\\u0026');
function safeFolder(value) {
    const raw = String(value || '').trim().replace(/\\/g, '/');
    if (!raw || raw.startsWith('/') || /^[A-Za-z]:/.test(raw) || raw.split('/').some(p => p === '..') || /[<>:"|?*\x00-\x1f]/.test(raw))
        throw new Error('导出目录须为库内相对路径，不允许 .. 或绝对路径。');
    return normalizePath(raw);
}
function dataUrl(blob) { return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); }); }
export default class AcademicNotes extends Plugin {
    [key: string]: any;
    settings: AcademicSettingsData;
    async onload() {
        this.errors = [] as any[];
        this.graph = null;
        this.revision = 0;
        this.active = true;
        this.busy = false;
        this.indexRunning = false;
        this.appearanceBefore = { palette: document.body.getAttribute('data-an-palette'), classes: Object.fromEntries(['an-active', 'phb-neutral-body', 'phb-no-motif'].map(c => [c, document.body.classList.contains(c)])) };
        this.editorViews = new Set();
        this.readers = new Set();
        this.parsed = new Map();
        this.dirty = new Map();
        this.pdfJobs = new Set();
        try {
            const data = await this.loadData();
            this.settings = Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => [key, data?.[key] ?? value])) as AcademicSettingsData;
        }
        catch (e) {
            this.settings = { ...DEFAULTS };
            this.recordError('读取 data.json（已回退默认值）', e);
        }
        // Registration does not depend on the PDF runtime or other plugins.
        this.addCommand({ id: 'export-current-pdf', name: '直接导出当前笔记为 PDF', callback: () => this.exportActive(false, true) });
        this.addCommand({ id: 'export-selected-pdf', name: '选择多篇笔记并导出合订本 PDF', callback: () => new BookPicker(this).open() });
        this.addCommand({ id: 'export-book-pdf', name: '按 phb-book 清单导出 PDF', callback: () => this.exportActive(true, true) });
        this.addCommand({ id: 'export-current', name: '导出当前笔记为 HTML 快照', callback: () => this.exportActive(false, false) });
        this.addCommand({ id: 'export-book', name: '按 phb-book 清单导出 HTML 快照', callback: () => this.exportActive(true, false) });
        this.addCommand({ id: 'diagnostics', name: '检查插件状态与导出环境', callback: () => this.diagnostics() });
        this.addCommand({ id: 'refresh', name: '重建定理公式索引并刷新引用', callback: () => { this.parsed.clear(); this.rebuild().then(() => new Notice('索引已重建。')).catch(e => this.fail('重建索引', e)); } });
        this.addCommand({ id: 'insert-reference', name: '插入定理、公式或图表引用', editorCallback: (editor, view) => new ReferencePicker(this, editor, view.file).open() });
        this.addCommand({ id: 'label-block', name: '为光标所在公式、定理或图表添加块 ID', editorCallback: (editor, view) => this.labelBlock(editor, view.file) });
        this.addSettingTab(new AcademicSettings(this.app, this));
        this.registerMarkdownPostProcessor((el, ctx) => this.postprocess(el, ctx), 110);
        const tocProcessor = (source, el, ctx) => {
            if (el.closest('.phb-export-stage')) {
                el.className = 'phb-toc-placeholder';
                return;
            }
            const depth = Number(source.match(/[1-6]/)?.[0]) || this.settings.tocDepth;
            return this.renderToc(el, ctx, depth);
        };
        try {
            this.registerMarkdownCodeBlockProcessor('academic-toc', tocProcessor);
        }
        catch (e) {
            if (!/already registered/i.test(String(e?.message || e)))
                throw e;
            this.recordError('academic-toc 已被占用；保留 [toc] 和编号功能', e);
        }
        try {
            this.registerEditorExtension(createLiveExtension(this));
            this.liveExtension = true;
        }
        catch (e) {
            this.liveExtension = false;
            this.recordError('加载实时预览扩展（阅读模式仍可用）', e);
        }
        if (Obs.EditorSuggest)
            this.registerEditorSuggest(new ReferenceSuggest(this));
        this.registerEvent(this.app.metadataCache.on('changed', file => { if (file)
            this.dirty.set(file.path, true); this.scheduleIndex(); }));
        this.registerEvent(this.app.vault.on('create', () => this.scheduleIndex()));
        this.registerEvent(this.app.vault.on('delete', () => this.scheduleIndex()));
        this.registerEvent(this.app.vault.on('rename', () => this.scheduleIndex()));
        this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
            if (info?.file) {
                this.dirty.set(info.file.path, editor.getValue());
                this.scheduleIndex();
            }
        }));
        if (typeof this.settings.excludedFolders !== 'string')
            this.settings.excludedFolders = '';
        this.applyAppearance();
        this.themeObserver = new MutationObserver(() => this.applyAppearance());
        this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        this.register(() => this.themeObserver.disconnect());
        this.app.workspace.onLayoutReady(() => { if (this.active)
            this.rebuild().catch(e => this.fail('建立索引', e)); });
    }
    onunload() {
        this.active = false;
        clearTimeout(this.indexTimer);
        this.readers.clear();
        for (const job of this.pdfJobs)
            job.abort();
        this.themeObserver?.disconnect();
        const before = this.appearanceBefore;
        if (before) {
            if (before.palette === null)
                document.body.removeAttribute('data-an-palette');
            else
                document.body.setAttribute('data-an-palette', before.palette);
            for (const [c, v] of Object.entries(before.classes))
                document.body.classList.toggle(c, Boolean(v));
        }
        // Restoring native render trees is left to Obsidian when notes are reopened.
    }
    recordError(where, error) { const entry = { time: new Date().toISOString(), where, message: String(error?.message || error), stack: error?.stack || '' }; this.errors.push(entry); if (this.errors.length > 40)
        this.errors.shift(); console.error('[Academic Notes]', where, error); }
    fail(where, error) { this.recordError(where, error); new Notice(where + '失败：' + (error?.message || error) + '\n可运行“检查插件状态与导出环境”。', 13000); }
    async saveSettings() { await this.saveData(this.settings); this.applyAppearance(); this.scheduleIndex(); }
    applyAppearance() {
        if (!this.active)
            return;
        const b = document.body, dark = b.classList.contains('theme-dark'), palette = dark ? this.settings.darkPalette : this.settings.lightPalette;
        if (b.dataset.anPalette !== palette)
            b.dataset.anPalette = palette;
        const set = (c, v) => { if (b.classList.contains(c) !== v)
            b.classList.toggle(c, v); };
        set('an-active', true);
        set('phb-neutral-body', !!this.settings.neutralBody);
        set('phb-no-motif', !!this.settings.hideMotif);
    }
    scheduleIndex() { if (!this.active)
        return; clearTimeout(this.indexTimer); this.indexTimer = setTimeout(() => this.rebuild().catch(e => this.fail('更新索引', e)), Math.max(150, this.settings.indexDelay || 450)); }
    included(file) { const path = file.path; const excluded = this.settings.excludedFolders.split(/\n/).map(x => x.trim().replace(/\/$/, '')).filter(Boolean); return !excluded.some(p => path === p || path.startsWith(p + '/')); }
    resolver(name, here) { return this.app.metadataCache.getFirstLinkpathDest(name, here)?.path || null; }
    async rebuild() {
        if (this.indexRunning) {
            this.rerun = true;
            return this.indexPromise;
        }
        this.indexRunning = true;
        this.indexPromise = (async () => {
            const files = this.app.vault.getMarkdownFiles().filter(f => this.included(f)), notes = [] as any[];
            // Open buffers win over a disk read: numbering does not force a save.
            const open = new Map();
            for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
                if (leaf.view instanceof MarkdownView && leaf.view.file && leaf.view.getMode() === 'source')
                    open.set(leaf.view.file.path, leaf.view.editor.getValue());
            }
            for (let i = 0; i < files.length; i++) {
                const f = files[i], cache = this.app.metadataCache.getFileCache(f) || {};
                const old = this.parsed.get(f.path), fromEditor = open.has(f.path);
                const text = fromEditor ? open.get(f.path) : (old && old._mtime === f.stat.mtime && !old._fromEditor && !this.dirty.has(f.path) ? old.source : await this.app.vault.cachedRead(f));
                let n = old?.source === text && !this.dirty.has(f.path) ? old : Engine.parse(f.path, text, cache);
                n._mtime = f.stat.mtime;
                n._fromEditor = fromEditor;
                this.dirty.delete(f.path);
                this.parsed.set(f.path, n);
                notes.push(n);
                if (i % 40 === 39)
                    await sleep(0);
            }
            if (!this.active)
                return;
            const paths = new Set(files.map(f => f.path));
            for (const p of this.parsed.keys())
                if (!paths.has(p))
                    this.parsed.delete(p);
            this.graph = Engine.graph(notes, this.settings, (n, h) => this.resolver(n, h));
            this.revision++;
            for (const refresh of this.readers) {
                try {
                    refresh();
                }
                catch (e) {
                    this.recordError('刷新阅读片段', e);
                }
            }
            for (const view of this.editorViews) {
                try {
                    view.dispatch({ effects: this.refreshEffect.of(this.revision) });
                }
                catch (e) {
                    this.recordError('刷新编辑器', e);
                }
            }
        })();
        try {
            await this.indexPromise;
        }
        finally {
            this.indexRunning = false;
            if (this.rerun) {
                this.rerun = false;
                this.scheduleIndex();
            }
        }
    }
    postprocess(el, ctx) {
        if (el.closest('.phb-export-stage'))
            return;
        const refresh = () => { const n = this.graph?.notes.get(ctx.sourcePath); if (!n)
            return; renderFragment(el, n, this.graph, node => ctx.getSectionInfo(node) || ctx.getSectionInfo(el)); };
        const plugin = this;
        class Reader extends MarkdownRenderChild {
            follow: (event: any) => void;
            onload() {
                plugin.readers.add(refresh);
                refresh();
                this.follow = event => {
                    if (event.defaultPrevented || (event.type === 'click' && event.button !== 0) || (event.type === 'keydown' && event.key !== 'Enter'))
                        return;
                    const a = event.target?.closest?.('a.internal-link,a[data-href]');
                    if (!a || !el.contains(a))
                        return;
                    const raw = a.dataset.href || a.getAttribute('href') || '';
                    if (!plugin.graph?.resolve(raw, ctx.sourcePath))
                        return;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    plugin.openReference(raw, ctx.sourcePath, !!(event.ctrlKey || event.metaKey)).catch(e => plugin.fail('打开块引用', e));
                };
                el.addEventListener('click', this.follow, true);
                el.addEventListener('keydown', this.follow, true);
            }
            onunload() { plugin.readers.delete(refresh); el.removeEventListener('click', this.follow, true); el.removeEventListener('keydown', this.follow, true); }
        }
        ctx.addChild(new Reader(el));
        for (const p of allNodes(el, 'p'))
            if (/^\[toc\]$/i.test(p.textContent.trim()) && !p.closest('.callout'))
                this.renderToc(p, ctx, this.settings.tocDepth).catch(e => this.recordError('目录渲染', e));
    }
    async renderToc(el, ctx, depth) {
        const hs = (this.app.metadataCache.getCache(ctx.sourcePath)?.headings || []).filter(h => h.level <= depth);
        const list = hs.filter((h, i) => i !== 0 || h.level !== 1), entries = list.map((h, i) => ({ id: 'an-toc-' + i, title: h.heading, level: h.level }));
        const nav = DocCore.makeToc(el.ownerDocument, entries);
        nav.classList.add('an-live-toc');
        nav.querySelectorAll('.phb-toc-page,.phb-toc-leader').forEach(e => e.remove());
        [...nav.querySelectorAll('[data-phb-target]')].forEach((a, i) => { a.href = '#' + encodeURIComponent(list[i].heading); a.addEventListener('click', e => { e.preventDefault(); this.app.workspace.openLinkText(ctx.sourcePath + '#' + list[i].heading, ctx.sourcePath); }); });
        if (el.tagName === 'P')
            el.replaceWith(nav);
        else
            el.replaceChildren(nav);
        const child = new MarkdownRenderChild(nav);
        ctx.addChild(child);
        const links = [...nav.querySelectorAll('[data-phb-target]')];
        for (let i = 0; i < links.length; i++) {
            const a = links[i];
            a.replaceChildren();
            await MarkdownRenderer.render(this.app, list[i].heading, a, ctx.sourcePath, child);
            if (a.firstElementChild?.tagName === 'P')
                a.replaceChildren(...a.firstElementChild.childNodes);
        }
        await Obs.finishRenderMath();
    }
    labelBlock(editor, file) {
        if (!file)
            return;
        const note = Engine.parse(file.path, editor.getValue()), line = editor.getCursor().line;
        const r = note.records.filter(r => r.line <= line && r.endLine >= line).sort((a, b) => b.line - a.line)[0];
        if (!r) {
            new Notice('请把光标放到 $$ 公式块或定理、figure、subfigure、table Callout 内。');
            return;
        }
        if (r.id) {
            new Notice('该块已有 ID：^' + r.id);
            return;
        }
        let id;
        do {
            id = 'an-' + Math.random().toString(36).slice(2, 10);
        } while (note.blocks.has(id));
        const prefix = r.kind === 'equation' ? Engine.quote(note.lines[r.endLine]).prefix : (r.depth > 1 ? '> '.repeat(r.depth - 1) : '');
        const insertion = '\n' + prefix + '\n' + prefix + '^' + id + '\n';
        editor.replaceRange(insertion, { line: r.endLine, ch: note.lines[r.endLine].length });
        this.scheduleIndex();
        new Notice('已添加 ^' + id + '；可用 [[#^' + id + ']] 引用。');
    }
    async openReference(raw, sourcePath, newLeaf = false) {
        const rec = this.graph?.resolve(raw, sourcePath);
        if (!rec)
            return this.app.workspace.openLinkText(raw, sourcePath, newLeaf);
        const file = this.app.vault.getAbstractFileByPath(rec.path);
        if (!(file instanceof TFile))
            throw new Error('引用目标文件不存在：' + rec.path);
        // Native metadata need not expose IDs of nested callouts. Navigate by our source location.
        const leaf = this.app.workspace.getLeaf(newLeaf ? 'tab' : false);
        await leaf.openFile(file, { active: true, eState: { line: rec.line } });
        if (leaf.view instanceof MarkdownView) {
            leaf.view.setEphemeralState({ line: rec.line });
            if (leaf.view.getMode() === 'source') {
                const from = { line: rec.line, ch: 0 };
                leaf.view.editor.setCursor(from);
                leaf.view.editor.scrollIntoView({ from, to: from }, true);
            }
        }
    }
    makeReference(record, sourcePath) { const target = record.path === sourcePath ? '' : record.path.replace(/\.md$/i, ''); return '[[' + target + '#^' + record.id + ']]'; }
    targets() { return this.graph ? [...this.graph.notes.values()].flatMap(n => n.records.filter(r => r.id)) : []; }
    pluginDir() { return this.manifest.dir || normalizePath(this.app.vault.configDir + '/plugins/' + this.manifest.id); }
    async mkdir(folder) { let p = ''; for (const part of safeFolder(folder).split('/')) {
        p += (p ? '/' : '') + part;
        if (!await this.app.vault.adapter.exists(p))
            await this.app.vault.adapter.mkdir(p);
    } }
    async resolveSelection(isBook) {
        const file = this.app.workspace.getActiveFile();
        if (!(file instanceof TFile) || file.extension !== 'md')
            throw new Error('请先打开一篇 Markdown 笔记。');
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {}, book = isBook ? fm['phb-book'] : null;
        if (isBook && !Array.isArray(book?.files))
            throw new Error('当前文件缺少 phb-book.files 清单。');
        const items = isBook ? book.files : [file.path], seen = new Set();
        const files = items.map(item => {
            const raw = typeof item === 'string' ? item : item?.path;
            if (typeof raw !== 'string')
                throw new Error('章节路径格式不正确。');
            const path = raw.replace(/^\[\[|\]\]$/g, '').split('|')[0];
            const f = this.app.vault.getAbstractFileByPath(path) || this.app.metadataCache.getFirstLinkpathDest(path, file.path);
            if (!(f instanceof TFile) || f.extension !== 'md')
                throw new Error('找不到章节：' + path);
            if (seen.has(f.path))
                throw new Error('重复章节：' + f.path);
            seen.add(f.path);
            return { file: f, title: typeof item === 'object' && item.title || f.basename };
        });
        if (!files.length)
            throw new Error('章节清单为空。');
        return { files, options: { book: isBook, title: book?.title || fm.title || file.basename, subtitle: book?.subtitle || '', tocDepth: book?.tocDepth || this.settings.tocDepth } };
    }
    async exportActive(isBook, pdf) { try {
        const selection = await this.resolveSelection(isBook);
        await this.exportSelection(selection, pdf);
    }
    catch (e) {
        this.fail('导出', e);
    } }
    async exportSelection(selection, pdf = true) {
        if (this.busy) {
            new Notice('已有导出任务正在运行。');
            return;
        }
        this.busy = true;
        if (pdf) this.lastPdfExport = { status: 'running', time: new Date().toISOString() };
        const log = new ProgressModal(this.app, pdf ? '导出 PDF' : '生成 HTML 快照');
        log.open();
        try {
            await this.rebuild();
            log.line('正在完整渲染所选章节…');
            const snapshot = await this.snapshot(selection, log);
            log.line('HTML 快照已保存：' + snapshot);
            if (pdf) {
                const out = snapshot.replace(/\.phb\.html$/, '.pdf');
                const controller = new AbortController();
                this.pdfJobs.add(controller);
                try {
                    const html = await this.app.vault.adapter.read(snapshot);
                    const result = await exportPdf(html, line => log.line(line), controller.signal);
                    if (!this.active)
                        throw new Error('插件已停用。');
                    await this.app.vault.adapter.writeBinary(out, new Uint8Array(result.bytes).buffer);
                    await this.app.vault.adapter.write(out.replace(/\.pdf$/, '.report.json'), JSON.stringify(result.report, null, 2));
                    this.lastPdfExport = { status: 'success', time: new Date().toISOString(), output: out, report: result.report };
                    log.line('已完成：' + out);
                    new Notice('PDF 已保存：' + out, 10000);
                    if (this.settings.openPdf) {
                        for (let i = 0; i < 15; i++) {
                            const f = this.app.vault.getAbstractFileByPath(out);
                            if (f instanceof TFile) {
                                await this.app.workspace.getLeaf('tab').openFile(f);
                                break;
                            }
                            await sleep(200);
                        }
                    }
                }
                finally {
                    this.pdfJobs.delete(controller);
                }
            }
            else
                new Notice('HTML 快照已保存：' + snapshot);
            log.done();
        }
        catch (e) {
            if (pdf) this.lastPdfExport = { status: 'failed', time: new Date().toISOString(), message: String(e.message || e) };
            log.line('错误：' + e.message);
            log.line('查看完整错误：命令面板 → 检查插件状态与导出环境 → errors；可保存诊断 JSON。');
            log.done();
            this.fail('导出', e);
        }
        finally {
            this.busy = false;
        }
    }
    exportSource(note, graph) {
        const replacements = [] as any[];
        for (const eq of note.equations) {
            if (eq.manual || eq.multiTag)
                continue;
            const tex = Engine.taggedTex(eq), q = Engine.quote(note.lines[eq.line]).prefix;
            const math = tex.includes('\n') ? '$$\n' + tex.split('\n').map(l => q + l).join('\n') + '\n' + q + '$$' : '$$' + tex + '$$';
            replacements.push({ from: eq.from, to: eq.to, text: math });
        }
        for (const r of note.refs)
            if (!r.embed && r.target && (!this.settings.respectAliases || r.alias === null) && r.syntax === 'wiki') {
                const label = Engine.refText(r.target, graph.settings)!.replace(/\|/g, '\\|').replace(/\]/g, '');
                replacements.push({ from: r.from, to: r.to, text: '[[' + r.raw + '|' + label + ']]' });
            }
        let text = note.source;
        for (const r of replacements.sort((a, b) => b.from - a.from))
            text = text.slice(0, r.from) + r.text + text.slice(r.to);
        // Original files are untouched. Normalize only this export copy.
        text = text.replace(/^([ \t]*)(`{3,}|~{3,})[ \t]*(?:toc|academic-toc)[ \t]*\r?\n[\s\S]*?^\1\2[ \t]*$/gim, '[toc]');
        text = text.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '');
        let fence: string | null = null;
        return text.split('\n').map(raw => {
            const m = Engine.quote(raw).body.match(/^(`{3,}|~{3,})/);
            if (m) {
                if (!fence) {
                    fence = m[1];
                    if (/^(`{3,}|~{3,})\s*(?:toc|academic-toc)\s*$/i.test(Engine.quote(raw).body))
                        return Engine.quote(raw).prefix + m[1] + 'academic-toc';
                }
                else if (m[1][0] === fence[0] && m[1].length >= fence.length)
                    fence = null;
                return raw;
            }
            if (fence)
                return raw;
            const q = Engine.quote(raw), b = q.body.match(/^\s*\^([\w-]+)\s*$/);
            if (b)
                return q.prefix + '<span class="phb-anchor" data-phb-block="' + b[1] + '"></span>';
            return raw;
        }).join('\n');
    }
    async snapshot({ files, options }, log) {
        const warnings = [] as any[], notes = [] as any[];
        for (const { file: f } of files) {
            const existing = this.graph?.notes.get(f.path);
            const source = existing?.source ?? await this.app.vault.cachedRead(f);
            notes.push(Engine.parse(f.path, source, this.app.metadataCache.getFileCache(f) || {}));
        }
        const chapterMap = options.book && this.settings.exportNumbering !== 'note' ? new Map(notes.map((n, i) => [n.path, { chapter: i + 1, mode: this.settings.exportNumbering }])) : undefined;
        const graph = Engine.graph(notes, this.settings, (n, h) => this.resolver(n, h), chapterMap);
        warnings.push(...graph.warnings);
        if (options.book && this.settings.exportNumbering === 'note') {
            // Freeze vault-view numbers, including equations referenced by unselected notes.
            for (const note of notes) {
                const original = this.graph?.notes.get(note.path);
                if (!original || original.source !== note.source)
                    continue;
                for (const rec of note.records) {
                    const old = original.records.find(r => r.from === rec.from && r.kind === rec.kind);
                    if (old)
                        for (const k of ['number', 'prefix', 'subletter', 'referenced'])
                            rec[k] = old[k];
                }
            }
            warnings.push('保留笔记编号模式：不同章节可能显示相同编号；跳转仍按文件路径和块 ID 区分。');
        }
        for (const n of notes)
            for (const ref of n.refs)
                if (!ref.target)
                    warnings.push(`${n.path}:${ref.line + 1} 引用目标未纳入本次导出或不可解析：${ref.raw}`);
        const doc: Document = this.app.workspace.getActiveViewOfType(MarkdownView)?.containerEl.ownerDocument || document;
        const stage = doc.createElement('main');
        stage.id = 'phb-document';
        stage.className = 'phb-export-stage markdown-preview-view markdown-rendered';
        doc.body.appendChild(stage);
        const component = new Component();
        component.load();
        try {
            for (let i = 0; i < files.length; i++) {
                const { file: f, title } = files[i], note = notes[i], section = doc.createElement('section');
                section.className = 'phb-chapter';
                section.dataset.path = f.path;
                section.dataset.title = title;
                const fm = this.app.metadataCache.getFileCache(f)?.frontmatter || {}, classes = Array.isArray(fm.cssclasses) ? fm.cssclasses : typeof fm.cssclasses === 'string' ? fm.cssclasses.split(/[, ]+/) : [];
                for (const c of classes)
                    if (typeof c === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(c))
                        section.classList.add(c);
                stage.appendChild(section);
                await MarkdownRenderer.render(this.app, this.exportSource(note, graph), section, f.path, component);
                await Obs.finishRenderMath();
                // Map declaration anchors to their actual rendered boxes/equations.
                const boxes = [...section.querySelectorAll<HTMLElement>('.callout[data-callout]')], math = [...section.querySelectorAll<HTMLElement>('mjx-container[display="true"]')];
                const consumed = new Set();
                for (const rec of note.callouts) {
                    const box = boxes.find(b => !consumed.has(b) && (Engine.canon(b.dataset.callout) || Engine.mediaCanon(b.dataset.callout)) === rec.key);
                    if (box) {
                        consumed.add(box);
                        if (rec.kind === 'theorem')
                            titleRecord(box, rec);
                        else
                            mediaRecord(box, rec);
                        if (rec.id)
                            box.dataset.phbBlock = rec.id;
                        if (rec.ids.length)
                            box.dataset.phbBlocks = JSON.stringify(rec.ids);
                    }
                }
                if (math.length === note.equations.length)
                    note.equations.forEach((r, j) => { if (r.id) {
                        const node = math[j].parentElement || math[j];
                        node.dataset.phbBlock = r.id;
                        node.dataset.phbBlocks = JSON.stringify(r.ids);
                    } });
                else
                    warnings.push(f.path + '：原生数学节点数与源码不一致；无法定位的数学锚点将保留在原位置。');
                const realIds = new Set([...section.querySelectorAll<HTMLElement>('[data-phb-block]:not(.phb-anchor)')].map(e => e.dataset.phbBlock));
                section.querySelectorAll<HTMLElement>('.phb-anchor').forEach(e => { if (realIds.has(e.dataset.phbBlock))
                    e.remove(); });
                for (const a of section.querySelectorAll<HTMLElement>('a[href],a[data-href]')) {
                    if (a.closest('svg,mjx-container'))
                        continue;
                    const raw = a.dataset.phbLink || a.dataset.href || a.getAttribute('href') || '', ref = Engine.splitTarget(raw), target = ref && graph.resolve(raw, f.path);
                    if (target) {
                        a.classList.add('an-ref');
                        a.dataset.phbLink = target.path + '#^' + ref.block;
                        a.dataset.phbCanonical = 'true';
                    }
                    else if (ref) {
                        a.dataset.phbMissing = 'true';
                    }
                }
                log.line('渲染：' + f.path);
            }
            await Obs.finishRenderMath();
            DocCore.unfold(stage);
            await doc.fonts.ready;
            await this.waitStable(stage);
            await this.inlineImages(stage);
            if (stage.querySelector('[data-mml-node="merror"],mjx-merror'))
                throw new Error('检测到数学渲染错误，已停止 PDF 导出；请先检查原公式。');
            const opts = { ...options, preNumbered: true, toc: true }, meta = { ...opts, ...DocCore.prepare(stage, opts), nativeSnapshot: true };
            meta.warnings.push(...warnings);
            meta.numberingMode = options.book ? this.settings.exportNumbering : 'note';
            meta.targets = notes.flatMap(n => n.records.filter(r => r.id).map(r => ({ path: r.path, block: r.id, kind: r.kind, number: r.number, reference: Engine.refText(r, graph.settings) })));
            // Export every globally cached MathJax glyph used by the snapshot.
            const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), defs = doc.createElementNS(svg.namespaceURI, 'defs');
            svg.appendChild(defs);
            svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
            const copied = new Set();
            stage.querySelectorAll('svg use').forEach(u => { const href = u.getAttribute('href') || u.getAttribute('xlink:href'); if (href?.startsWith('#')) {
                const e = doc.getElementById(href.slice(1));
                if (e && !stage.contains(e) && !copied.has(e.id)) {
                    defs.appendChild(e.cloneNode(true));
                    copied.add(e.id);
                }
            } });
            const baseCss = calloutCss + '\n' + layoutCss, printCss = documentCss;
            let css = this.settings.captureTheme ? await this.collectCss(doc, meta.warnings) : baseCss;
            const bodyStyle = doc.defaultView!.getComputedStyle(doc.body), variables = [...bodyStyle].filter(k => k.startsWith('--')).map(k => `${k}:${bodyStyle.getPropertyValue(k)};`).join('');
            const classes = [...doc.body.classList].filter(c => !['is-mobile', 'is-phone'].includes(c)).join(' ') + ' phb-export';
            stage.querySelectorAll('script,iframe,object,embed,form,audio,video').forEach(e => e.remove());
            stage.querySelectorAll('*').forEach(e => [...e.attributes].forEach(a => { if (a.name.toLowerCase().startsWith('on') || (['href', 'src'].includes(a.name) && /^javascript:/i.test(a.value)))
                e.removeAttribute(a.name); }));
            const csp = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline' data:; font-src data:; script-src 'none'; base-uri 'none'; form-action 'none'";
            const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="phb-version" content="2"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${DocCore.escape(options.title)}</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style><style>${printCss}</style></head><body class="${DocCore.escape(classes)}" data-an-palette="${DocCore.escape(doc.body.dataset.anPalette || 'theme')}" style="${DocCore.escape(variables)}">${defs.childNodes.length ? svg.outerHTML : ''}<main id="phb-document" class="markdown-preview-view markdown-rendered">${stage.innerHTML}</main><script id="phb-meta" type="application/json">${jsonSafe(meta)}</script></body></html>`;
            const folder = safeFolder(this.settings.exportFolder);
            await this.mkdir(folder);
            const safe = String(options.title || 'Book').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80), stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const path = folder + '/' + safe + '-' + stamp + '.phb.html';
            await this.app.vault.adapter.write(path, html);
            await this.app.vault.adapter.write(path + '.report.json', JSON.stringify(meta, null, 2));
            return path;
        }
        finally {
            component.unload();
            stage.remove();
        }
    }
    async waitStable(stage) { await new Promise<void>(resolve => { let quiet, limit; const done = () => { clearTimeout(quiet); clearTimeout(limit); o.disconnect(); resolve(); }; const o = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(done, 400); }); o.observe(stage, { childList: true, subtree: true }); quiet = setTimeout(done, 400); limit = setTimeout(done, 8000); }); }
    async inlineImages(stage) {
        for (const canvas of [...stage.querySelectorAll('canvas')]) {
            const img = stage.ownerDocument.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.width = canvas.width;
            img.height = canvas.height;
            canvas.replaceWith(img);
        }
        for (const img of stage.querySelectorAll('img')) {
            const url = img.currentSrc || img.src;
            if (url.startsWith('data:'))
                continue;
            if (/^https?:/i.test(url))
                throw new Error('快照默认不下载网络图片，请先将图片存入 vault：' + url);
            let data;
            try {
                const r = await fetch(url);
                if (!r.ok)
                    throw new Error(String(r.status));
                data = await dataUrl(await r.blob());
            }
            catch (error) {
                const src = img.closest('.image-embed')?.getAttribute('src') || img.getAttribute('data-src');
                const path = img.closest('.phb-chapter')?.dataset.path || '';
                const file = src && this.app.metadataCache.getFirstLinkpathDest(src, path);
                if (!(file instanceof TFile))
                    throw new Error('无法嵌入图片：' + (src || url));
                const bytes = await this.app.vault.readBinary(file);
                const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', gif: 'image/gif' }[file.extension];
                if (!mime)
                    throw new Error('不支持的图片格式：' + file.path);
                data = await dataUrl(new Blob([bytes], { type: mime }));
            }
            img.removeAttribute('srcset');
            img.src = data;
            try {
                await img.decode();
            }
            catch {
                throw new Error('图片解码失败：' + (img.alt || url));
            }
        }
    }
    async collectCss(doc, warnings) {
        const seen = new Set(), chunks = [] as any[], cache = new Map();
        async function resource(url, base) {
            if (url.startsWith('data:') || url.startsWith('#') || !url)
                return url;
            let absolute;
            try {
                absolute = new URL(url, base || doc.location.href).href;
            }
            catch {
                return url;
            }
            if (cache.has(absolute))
                return cache.get(absolute);
            if (!/^(app:|file:|blob:)/i.test(absolute)) {
                warnings.push('未联网下载 CSS 资源：' + absolute);
                return url;
            }
            try {
                const r = await fetch(absolute);
                if (!r.ok)
                    throw new Error(String(r.status));
                const data = await dataUrl(await r.blob());
                cache.set(absolute, data);
                return data;
            }
            catch {
                warnings.push('未能内嵌 CSS 资源，可能影响字体/背景：' + absolute);
                return url;
            }
        }
        async function visit(sheet) {
            if (seen.has(sheet))
                return;
            seen.add(sheet);
            let rules;
            try {
                rules = sheet.cssRules;
            }
            catch {
                warnings.push('无法读取一个样式表：' + sheet.href);
                return;
            }
            for (const rule of rules) {
                if (rule.type === 3 && rule.styleSheet) {
                    await visit(rule.styleSheet);
                    continue;
                }
                let text = rule.cssText;
                const pattern = /url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g;
                let out = '', from = 0;
                for (const m of text.matchAll(pattern)) {
                    const url = (m[1] || m[2] || m[3] || '').trim();
                    out += text.slice(from, m.index) + 'url("' + (await resource(url, sheet.href)).replace(/"/g, '%22') + '")';
                    from = m.index + m[0].length;
                }
                chunks.push(out + text.slice(from));
            }
        }
        for (const sheet of doc.styleSheets)
            await visit(sheet);
        return chunks.join('\n');
    }
    async diagnostics() {
        const result = { plugin: this.manifest.name, version: this.manifest.version, indexedFiles: this.graph?.notes.size || 0,
            warnings: this.graph?.warnings || [], errors: this.errors.slice(), pdf: pdfAvailability(), lastPdfExport: this.lastPdfExport || { status: 'not-run-this-session' } };
        const modal = new Modal(this.app);
        modal.titleEl.setText('Academic Notes 诊断');
        const pre = modal.contentEl.createEl('pre', { text: JSON.stringify(result, null, 2) });
        pre.classList.add('an-diagnostics');
        new Setting(modal.contentEl).addButton(b => b.setButtonText('保存诊断 JSON 到导出目录').onClick(async () => { try {
            const folder = safeFolder(this.settings.exportFolder);
            await this.mkdir(folder);
            const path = folder + '/academic-diagnostics-' + Date.now() + '.json';
            await this.app.vault.adapter.write(path, JSON.stringify(result, null, 2));
            new Notice('已保存 ' + path);
        }
        catch (e) {
            this.fail('保存诊断', e);
        } }));
        modal.open();
    }
}
