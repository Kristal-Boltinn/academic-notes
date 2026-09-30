import { Modal, MarkdownView, TFile, Notice, type App, type Editor, type MarkdownPostProcessorContext } from 'obsidian';
import { t } from '../i18n';
import { DiagramEditor } from '../diagrams/editor';
import { diagramBlocks, diagramFence, emptyDiagram, parseDiagram, type DiagramData } from '../diagrams/model';
import { renderDiagram } from '../diagrams/render';
import Engine from '../indexing/engine';

export function diagramDeletionRange(content: string, from: number, to: number) {
    const record = Engine.parse('', content).media.find(r => r.diagram && r.from === from);
    const next = content.slice(to).match(/^\r?\n(?:[ \t]*(?:>[ \t]*)*\r?\n)*([^\r\n]*)/);
    const marker = next && Engine.quote(next[1]).body.trim().match(/^\^([\w-]+)$/);
    if (record && marker && record.ids.includes(marker[1])) to += next[0].length;
    return { from, to };
}

export class DiagramModal extends Modal {
    constructor(app: App, private initial: DiagramData, private save: (data: DiagramData) => Promise<void>) { super(app); }
    onOpen() { this.titleEl.setText(t('交换图编辑器（Beta）')); this.modalEl.addClass('an-diagram-modal'); new DiagramEditor(this.contentEl, this.initial, async data => { await this.save(data); this.close(); }); }
    onClose() { this.contentEl.empty(); }
}
export function openDiagramEditor(app: App, editor: Editor) {
    const source = editor.getValue(), offset = editor.posToOffset(editor.getCursor()), block = diagramBlocks(source).find(b => offset >= b.from && offset <= b.to);
    const initial = block ? parseDiagram(block.source) : emptyDiagram();
    new DiagramModal(app, initial, async data => {
        if (editor.getValue() !== source) throw new Error(t('笔记已变化，请重新打开交换图编辑器。'));
        if (block) editor.replaceRange(diagramFence(data, block.prefix), editor.offsetToPos(block.from), editor.offsetToPos(block.to));
        else {
            const line = editor.getCursor().line, raw = editor.getLine(line), prefix = raw.match(/^[ \t]*(?:>[ \t]*)*/)?.[0] || '';
            let id = 1; while (new RegExp('\\^fig-diagram-' + id + '(?![\\w-])').test(source)) id++;
            editor.replaceRange(diagramFence(data, prefix) + '\n' + prefix + '\n' + prefix + '^fig-diagram-' + id + '\n' + prefix + '\n', { line, ch: 0 });
        }
        editor.focus();
    }).open();
}
export async function diagramProcessor(app: App, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    try {
        const data = parseDiagram(source); el.addClass('an-diagram-block'); el.contentEditable = 'false';
        const figure = el.createDiv({ cls: 'an-diagram-figure' }); await renderDiagram(figure, data);
        const caption = el.createDiv({ cls: 'an-diagram-caption' }); caption.hidden = true;
        caption.createDiv({ cls: 'callout-title-inner', text: data.caption || '' });
        if (el.closest('.phb-export-stage')) return;
        const actions = el.createDiv({ cls: 'an-diagram-actions' });
        actions.addEventListener('pointerdown', event => event.stopPropagation());
        const button = actions.createEl('button', { text: t('编辑交换图'), cls: 'an-diagram-edit' });
        const remove = actions.createEl('button', { text: t('删除交换图'), cls: 'an-diagram-delete' });
        const locate = async () => {
            const file = app.vault.getAbstractFileByPath(ctx.sourcePath); if (!(file instanceof TFile)) return;
            const view = app.workspace.getActiveViewOfType(MarkdownView), editor = view?.file?.path === ctx.sourcePath && view.getMode() === 'source' ? view.editor : null;
            const content = editor ? editor.getValue() : await app.vault.read(file), info = ctx.getSectionInfo(el);
            const matching = diagramBlocks(content).filter(b => b.source.trim() === source.trim());
            const block = matching.find(b => b.line === info?.lineStart) || (matching.length === 1 ? matching[0] : null);
            if (!block) throw new Error(t('无法唯一定位交换图，请把光标放入代码块后运行编辑命令。'));
            return { file, editor, content, block };
        };
        const fail = (error: unknown) => { new Notice(String(error instanceof Error ? error.message : error)); };
        button.addEventListener('click', event => { event.stopPropagation(); void (async () => {
            const located = await locate(); if (!located) return;
            const { file, editor, content, block } = located, old = content.slice(block.from, block.to);
            new DiagramModal(app, data, async updated => {
                const replace = (current: string) => { if (current.slice(block.from, block.to) !== old) throw new Error(t('笔记已变化，请重新打开交换图编辑器。')); return current.slice(0, block.from) + diagramFence(updated, block.prefix) + current.slice(block.to); };
                if (editor) { replace(editor.getValue()); editor.replaceRange(diagramFence(updated, block.prefix), editor.offsetToPos(block.from), editor.offsetToPos(block.to)); }
                else await app.vault.process(file, replace);
            }).open();
        })().catch(fail); });
        remove.addEventListener('click', event => { event.stopPropagation(); void (async () => {
            const located = await locate(); if (!located) return;
            const { file, editor, content, block } = located, range = diagramDeletionRange(content, block.from, block.to), old = content.slice(range.from, range.to);
            const replace = (current: string) => { if (current.slice(range.from, range.to) !== old) throw new Error(t('笔记已变化，请重新打开交换图编辑器。')); return current.slice(0, range.from) + current.slice(range.to); };
            if (editor) { replace(editor.getValue()); editor.replaceRange('', editor.offsetToPos(range.from), editor.offsetToPos(range.to)); }
            else await app.vault.process(file, replace);
        })().catch(fail); });
    } catch (error) { el.createEl('p', { text: t('交换图数据无效：') + String(error instanceof Error ? error.message : error) }); }
}
