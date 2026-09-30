import { Modal, MarkdownView, TFile, Notice, type App, type Editor, type MarkdownPostProcessorContext } from 'obsidian';
import { t } from '../i18n';
import { DiagramEditor } from '../diagrams/editor';
import { diagramBlocks, diagramFence, emptyDiagram, parseDiagram, type DiagramData } from '../diagrams/model';
import { renderDiagram } from '../diagrams/render';

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
        else { const line = editor.getCursor().line, raw = editor.getLine(line), prefix = raw.match(/^[ \t]*(?:>[ \t]*)*/)?.[0] || ''; editor.replaceRange(diagramFence(data, prefix) + '\n' + prefix + '\n', { line, ch: 0 }); }
        editor.focus();
    }).open();
}
export async function diagramProcessor(app: App, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    try {
        const data = parseDiagram(source); el.addClass('an-diagram-block');
        const figure = el.createDiv({ cls: 'an-diagram-figure' }); await renderDiagram(figure, data);
        if (el.closest('.phb-export-stage')) return;
        const button = el.createEl('button', { text: t('编辑交换图'), cls: 'an-diagram-edit' });
        button.addEventListener('click', () => { void (async () => {
            const file = app.vault.getAbstractFileByPath(ctx.sourcePath); if (!(file instanceof TFile)) return;
            const view = app.workspace.getActiveViewOfType(MarkdownView), editor = view?.file?.path === ctx.sourcePath && view.getMode() === 'source' ? view.editor : null;
            const content = editor ? editor.getValue() : await app.vault.read(file), info = ctx.getSectionInfo(el);
            const matching = diagramBlocks(content).filter(b => b.source.trim() === source.trim());
            const block = matching.find(b => b.line === info?.lineStart) || (matching.length === 1 ? matching[0] : null);
            if (!block) throw new Error(t('无法唯一定位交换图，请把光标放入代码块后运行编辑命令。'));
            const old = content.slice(block.from, block.to);
            new DiagramModal(app, data, async updated => {
                const replace = (current: string) => { if (current.slice(block.from, block.to) !== old) throw new Error(t('笔记已变化，请重新打开交换图编辑器。')); return current.slice(0, block.from) + diagramFence(updated, block.prefix) + current.slice(block.to); };
                if (editor) { replace(editor.getValue()); editor.replaceRange(diagramFence(updated, block.prefix), editor.offsetToPos(block.from), editor.offsetToPos(block.to)); }
                else await app.vault.process(file, replace);
            }).open();
        })().catch(error => { new Notice(String(error instanceof Error ? error.message : error)); }); });
    } catch (error) { el.createEl('p', { text: t('交换图数据无效：') + String(error instanceof Error ? error.message : error) }); }
}
