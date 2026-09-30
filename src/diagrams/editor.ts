import { t } from '../i18n';
import { emptyDiagram, parseDiagram, removeNode, resizeDiagram, type DiagramData } from './model';
import { renderDiagram } from './render';

export class DiagramEditor {
    data: DiagramData; selected = ''; selectedArrow = ''; mode = 'nodes'; start = ''; history: string[] = [];
    gridEl: HTMLElement; preview: HTMLElement; list: HTMLElement; status: HTMLElement;
    gridSelect: HTMLSelectElement; enabled: HTMLInputElement; caption: HTMLInputElement; nodeLabel: HTMLInputElement; arrowLabel: HTMLInputElement; style: HTMLSelectElement; side: HTMLSelectElement;
    constructor(private root: HTMLElement, initial: DiagramData = emptyDiagram(), private save: (data: DiagramData) => Promise<void> = async () => {}) {
        this.data = parseDiagram(JSON.stringify(initial)); root.addClass('an-diagram-editor');
        root.createEl('p', { text: t('点击网格启用或选择节点；在连线模式依次点起点和终点。公式使用 LaTeX，可省略两侧的 $。') });
        const toolbar = root.createDiv({ cls: 'an-diagram-toolbar' });
        const select = (parent: HTMLElement, name: string, options: Record<string, string>, value: string, action: (v: string) => void) => {
            const row = parent.createEl('label', { text: name }); const el = row.createEl('select', { attr: { 'aria-label': name } });
            for (const [key, text] of Object.entries(options)) el.createEl('option', { text, value: key });
            el.value = value; el.addEventListener('change', () => { el.blur(); action(el.value); }); return el;
        };
        this.gridSelect = select(toolbar, t('网格'), { '2': '2×2', '3': '3×3' }, String(this.data.grid), v => { this.remember(); resizeDiagram(this.data, Number(v) as 2 | 3); this.start = ''; this.refresh(); });
        select(toolbar, t('操作'), { nodes: t('选择节点'), arrows: t('连接箭头') }, this.mode, v => { this.mode = v; this.start = ''; this.refresh(); });
        const undo = toolbar.createEl('button', { text: t('撤销'), attr: { 'data-an-action': 'undo' } }); undo.addEventListener('click', () => { const old = this.history.pop(); if (old) this.data = parseDiagram(old); this.start = ''; this.refresh(); });
        this.gridEl = root.createDiv({ cls: 'an-diagram-grid' });
        const fields = root.createDiv({ cls: 'an-diagram-fields' });
        const nodeRow = fields.createEl('label', { text: t('启用当前节点') }); this.enabled = nodeRow.createEl('input', { type: 'checkbox' });
        this.enabled.addEventListener('change', () => { this.remember(); if (!this.enabled.checked) removeNode(this.data, this.selected); else this.activate(this.selected); this.refresh(); });
        const input = (name: string, action: (text: string) => void) => { const row = fields.createEl('label', { text: name }); const el = row.createEl('input', { type: 'text', attr: { maxlength: '200', 'aria-label': name } }); el.addEventListener('input', () => { this.remember(); action(el.value); this.refresh(); }); return el; };
        this.caption = input(t('图注（可留空）'), text => { this.data.caption = text; });
        this.nodeLabel = input(t('节点公式'), text => { const node = this.data.nodes.find(n => n.id === this.selected); if (node) node.label = text; });
        this.arrowLabel = input(t('箭头标注'), text => { const arrow = this.data.arrows.find(a => a.id === this.selectedArrow); if (arrow) arrow.label = text; });
        this.style = select(fields, t('箭头线型'), { solid: t('实线'), dashed: t('虚线') }, 'solid', v => { const arrow = this.data.arrows.find(a => a.id === this.selectedArrow); if (arrow) { this.remember(); arrow.style = v as 'solid' | 'dashed'; this.refresh(); } });
        this.side = select(fields, t('标注位置'), { above: t('左侧／上方'), below: t('右侧／下方') }, 'above', v => { const arrow = this.data.arrows.find(a => a.id === this.selectedArrow); if (arrow) { this.remember(); arrow.side = v as 'above' | 'below'; this.refresh(); } });
        const remove = fields.createEl('button', { text: t('删除当前箭头'), attr: { 'data-an-action': 'remove-arrow' } }); remove.addEventListener('click', () => { this.remember(); this.data.arrows = this.data.arrows.filter(a => a.id !== this.selectedArrow); this.refresh(); });
        this.list = root.createDiv({ cls: 'an-diagram-arrow-list' }); this.preview = root.createDiv({ cls: 'an-diagram-figure' }); this.status = root.createDiv({ cls: 'an-diagram-status', attr: { role: 'status' } });
        const button = root.createEl('button', { text: t('保存交换图'), cls: 'mod-cta', attr: { 'data-an-action': 'save' } });
        button.addEventListener('click', () => { button.disabled = true; void this.save(parseDiagram(JSON.stringify(this.data))).catch(error => { this.status.textContent = String(error instanceof Error ? error.message : error); }).finally(() => { button.disabled = false; }); });
        this.refresh();
    }
    remember() { this.history.push(JSON.stringify(this.data)); if (this.history.length > 40) this.history.shift(); }
    activate(id: string) {
        if (!id || this.data.nodes.some(n => n.id === id)) return;
        const match = id.match(/^n-(\d)-(\d)$/); if (!match) return;
        const row = Number(match[1]), col = Number(match[2]); if (row >= this.data.grid || col >= this.data.grid) return;
        this.data.nodes.push({ id, row, col, label: String.fromCharCode(65 + row * this.data.grid + col) });
    }
    choose(id: string) {
        this.remember(); this.activate(id); this.selected = id;
        if (this.mode === 'arrows') {
            if (!this.start) this.start = id;
            else if (this.start !== id) {
                let arrow = this.data.arrows.find(a => a.from === this.start && a.to === id);
                if (!arrow && this.data.arrows.length < 36) { let n = 1; while (this.data.arrows.some(a => a.id === 'a-' + n)) n++; arrow = { id: 'a-' + n, from: this.start, to: id, label: '', style: 'solid', side: 'above' }; this.data.arrows.push(arrow); }
                this.selectedArrow = arrow?.id || ''; this.start = '';
            } else this.start = '';
        }
        this.refresh();
    }
    refresh() {
        if (this.caption.value !== (this.data.caption || '')) this.caption.value = this.data.caption || '';
        this.gridSelect.value = String(this.data.grid); this.gridEl.dataset.grid = String(this.data.grid); this.gridEl.empty();
        for (let row = 0; row < this.data.grid; row++) for (let col = 0; col < this.data.grid; col++) {
            const id = `n-${row}-${col}`, node = this.data.nodes.find(n => n.row === row && n.col === col);
            const button = this.gridEl.createEl('button', { text: node?.label || '○', attr: { 'data-an-node': id, 'aria-label': `${row + 1}, ${col + 1}`, 'aria-pressed': String(!!node) } });
            button.classList.toggle('is-selected', this.selected === (node?.id || id)); button.classList.toggle('is-start', this.start === (node?.id || id)); button.addEventListener('click', () => this.choose(node?.id || id));
        }
        const node = this.data.nodes.find(n => n.id === this.selected), arrow = this.data.arrows.find(a => a.id === this.selectedArrow);
        if (!node && !/^n-[0-2]-[0-2]$/.test(this.selected)) this.selected = '';
        this.enabled.disabled = !this.selected; this.enabled.checked = !!node;
        this.nodeLabel.disabled = !node; if (this.nodeLabel.value !== (node?.label || '')) this.nodeLabel.value = node?.label || '';
        this.arrowLabel.disabled = this.style.disabled = this.side.disabled = !arrow;
        if (this.arrowLabel.value !== (arrow?.label || '')) this.arrowLabel.value = arrow?.label || '';
        this.style.value = arrow?.style || 'solid'; this.side.value = arrow?.side || 'above';
        this.list.empty(); for (const item of this.data.arrows) {
            const name = `${this.data.nodes.find(n => n.id === item.from)!.label} → ${this.data.nodes.find(n => n.id === item.to)!.label}`;
            const button = this.list.createEl('button', { text: name, attr: { 'aria-pressed': String(item.id === this.selectedArrow) } }); button.addEventListener('click', () => { this.selectedArrow = item.id; this.refresh(); });
        }
        this.status.textContent = this.start ? t('已选择起点，请点击终点。') : t('预览');
        void renderDiagram(this.preview, this.data, id => { this.selectedArrow = id; this.refresh(); }, this.selectedArrow).catch(error => { this.status.textContent = String(error); });
    }
}
