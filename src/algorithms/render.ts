import { renderMath, finishRenderMath } from 'obsidian';
import { t } from '../i18n';
import { localMathSvg } from '../diagrams/math';
import { nativeCalloutBodyInteraction, editorFragment } from '../rendering/editor-dom';
import { parseAlgorithm, type AlgorithmData, type AlgorithmNode } from './model';
import type { SourceRecord } from '../indexing/engine';

const pending = new WeakMap<HTMLElement, Promise<void>>();
const families: Record<string, string> = { normal: 'var(--font-text)', rm: 'var(--font-text)', sf: 'var(--font-interface)', tt: 'var(--font-monospace)' };
const sizes: Record<string, number> = { tiny: .68, scriptsize: .8, footnotesize: .85, small: .92, normalsize: 1, large: 1.17, Large: 1.41, LARGE: 1.58, huge: 1.9, Huge: 2.28 };
function styleText(span: HTMLElement, command: string) {
    const name = command.replace(/^text/, '');
    if (sizes[name]) span.style.fontSize = sizes[name] + 'em';
    if (/bf|md|lf/.test(name)) span.style.fontWeight = /bf/.test(name) ? 'bold' : /lf/.test(name) ? '300' : 'normal';
    if (/it|sl|up/.test(name)) span.style.fontStyle = /it|sl/.test(name) ? 'italic' : 'normal';
    if (name === 'sc' || name === 'scshape') span.classList.add('an-algorithm-smallcaps');
    if (name === 'uppercase' || name === 'lowercase') span.style.textTransform = name;
    for (const [key, family] of Object.entries(families)) if (name.startsWith(key)) span.style.fontFamily = family;
}
/** Own DOM renderer: user strings become text nodes, never HTML or executable TeX. */
export function renderAlgorithm(host: HTMLElement, data: AlgorithmData, number = '', lineNumbers = false, captionHost?: HTMLElement, name = t('算法')) {
    const doc = host.ownerDocument, formulas: { span: HTMLElement; source: string }[] = [];
    const signature = JSON.stringify([data, number, lineNumbers, !!captionHost?.isContentEditable, name]);
    if (host.dataset.anAlgorithm === signature) return;
    host.dataset.anAlgorithm = signature;
    host.classList.add('an-algorithm'); host.classList.remove('an-algorithm-error');
    // The settings switch controls all algorithms; block options can opt out.
    const showLineNumbers = lineNumbers && data.lineNumbers !== false;
    host.dataset.anAlgorithmLineNumbers = String(showLineNumbers);
    host.setAttribute('role', 'group');
    const content = captionHost ? host.querySelector<HTMLElement>(':scope > .callout-content') : host;
    if (!content) return;
    const caption = captionHost || doc.win.createDiv({ cls: 'an-algorithm-caption' });
    const body = doc.win.createDiv({ cls: 'an-algorithm-body' });
    content.replaceChildren(...(captionHost ? [body] : [caption, body]));
    const nativeTitle = !!captionHost?.isContentEditable;
    if (nativeTitle) caption.dataset.anAlgorithmLabel = name + (number ? ' ' + number : '');
    else { caption.removeAttribute('data-an-algorithm-label'); caption.replaceChildren(); }
    const decoratedCaption = nativeTitle ? doc.win.createDiv() : caption;
    decoratedCaption.createSpan({ cls: 'an-algorithm-label', text: name + (number ? ' ' + number : '') });
    const title = decoratedCaption.createSpan({ cls: 'an-algorithm-title' });
    const inline = (parent: HTMLElement, nodes: AlgorithmNode[]) => {
        for (let index = 0; index < nodes.length; index++) {
            const node = nodes[index], value = typeof node.value === 'string' ? node.value : '';
            if (node.whitespace) parent.appendChild(doc.createTextNode(' '));
            if (node.type === 'math') {
                const span = parent.createSpan({ cls: 'an-algorithm-math' });
                span.setAttribute('aria-label', value);
                try { span.appendChild(renderMath(value, false)); } catch { /* Local math fallback after the host finishes. */ }
                formulas.push({ span, source: value });
            } else if (node.type === 'cond-symbol') parent.createSpan({ cls: 'an-algorithm-keyword', text: value.toLowerCase() });
            else if (node.type === 'call') {
                parent.createSpan({ cls: 'an-algorithm-function', text: value }); parent.appendChild(doc.createTextNode('('));
                inline(parent, node.children || []); parent.appendChild(doc.createTextNode(')'));
            } else if (node.type === 'font-cmd') {
                const span = parent.createSpan(); styleText(span, value);
                const next = nodes[index + 1]; if (next?.type === 'close-text') { inline(span, next.children || []); index++; }
            } else if (node.type === 'font-dclr' || node.type === 'sizing-dclr') {
                const span = parent.createSpan(); styleText(span, value); inline(span, nodes.slice(index + 1)); break;
            } else if (node.children) inline(parent, node.children);
            else if (node.type === 'special') {
                if (value === '\\\\') parent.createEl('br'); else parent.appendChild(doc.createTextNode(value.slice(1)));
            } else if (node.type === 'text-symbol') parent.appendChild(doc.createTextNode('\\'));
            else if (node.type === 'quote-symbol') parent.appendChild(doc.createTextNode(({ '`': '‘', '``': '“', "'": '’', "''": '”' } as Record<string,string>)[value] || value));
            else parent.appendChild(doc.createTextNode(value));
        }
    };
    if (data.caption.length && !nativeTitle) { title.appendChild(doc.createTextNode(' · ')); inline(title, data.caption); }
    let serial = 0, current: HTMLElement | undefined;
    const line = (depth: number, keyword = '', text?: AlgorithmNode, ending = '', numbered = true) => {
        const row = body.createDiv({ cls: 'an-algorithm-line' });
        row.style.setProperty('--an-algorithm-depth', String(depth));
        const n = showLineNumbers ? row.createSpan({ cls: 'an-algorithm-line-number' }) : undefined;
        if (numbered) { serial++; if (n) n.textContent = String(serial); }
        current = row.createDiv({ cls: 'an-algorithm-line-content' });
        if (keyword) current.createSpan({ cls: 'an-algorithm-keyword', text: keyword });
        if (text) inline(current, text.children || [text]);
        if (ending) current.createSpan({ cls: 'an-algorithm-keyword', text: ending });
        return current;
    };
    const walk = (node: AlgorithmNode, depth = 0) => {
        const children = node.children || [], value = typeof node.value === 'string' ? node.value : '', options = typeof node.value === 'object' ? node.value : {};
        switch (node.type) {
            case 'algorithmic': case 'block': for (const child of children) walk(child, depth); break;
            case 'statement': line(depth, ({ state: '', input: 'Input: ', output: 'Output: ', require: 'Require: ', ensure: 'Ensure: ', return: 'return ', print: 'print ' } as Record<string,string>)[value], children[0], '', !['input','output','require','ensure'].includes(value)); break;
            case 'command': line(depth, value); break;
            case 'comment': {
                if (!current) current = line(depth, '', undefined, '', false);
                const comment = current.createSpan({ cls: 'an-algorithm-comment' }); comment.appendChild(doc.createTextNode(' // ')); inline(comment, children); break;
            }
            case 'function': {
                const row = line(depth, (options.type || 'function').toLowerCase() + ' ');
                row.createSpan({ cls: 'an-algorithm-function', text: options.name || '' }); row.appendChild(doc.createTextNode('(')); inline(row, children[0]?.children || []); row.appendChild(doc.createTextNode(')'));
                walk(children[1], depth + 1); line(depth, 'end ' + (options.type || 'function').toLowerCase()); break;
            }
            case 'loop': case 'upon': line(depth, (value === 'forall' ? 'for all' : value || 'upon') + ' ', children[0], node.type === 'loop' ? ' do' : ''); walk(children[1], depth + 1); line(depth, 'end ' + (value === 'forall' ? 'for' : value || 'upon')); break;
            case 'repeat': line(depth, 'repeat'); walk(children[0], depth + 1); line(depth, 'until ', children[1]); break;
            case 'if': {
                line(depth, 'if ', children[0], ' then'); walk(children[1], depth + 1);
                const count = options.numElif || 0;
                for (let i = 0; i < count; i++) { line(depth, 'else if ', children[2 + 2 * i], ' then'); walk(children[3 + 2 * i], depth + 1); }
                if (options.hasElse) { line(depth, 'else'); walk(children[2 + 2 * count], depth + 1); }
                line(depth, 'end if'); break;
            }
            default: throw new Error('Unsupported algorithm node: ' + node.type);
        }
    };
    walk(data.tree);
    const work = (async () => {
        let finished = true; try { await finishRenderMath(); } catch { finished = false; }
        for (const { span, source } of formulas) {
            if (host.dataset.anAlgorithm !== signature || !host.contains(span) && !caption.contains(span)) return;
            if (!finished || !span.querySelector('svg,mjx-container')) span.replaceChildren(await localMathSvg(doc, source));
        }
    })();
    pending.set(host, work);
    void work.catch(error => { if (host.dataset.anAlgorithm === signature) algorithmError(host, error); });
}
export function algorithmError(host: HTMLElement, error: unknown) {
    const message = String(error instanceof Error ? error.message : error);
    if (host.dataset.anAlgorithmError === message && host.querySelector('pre')) return;
    host.dataset.anAlgorithmError = message;
    host.classList.add('an-algorithm-error');
    host.removeAttribute('data-an-algorithm');
    const body = host.querySelector<HTMLElement>(':scope > .callout-content') || host;
    body.replaceChildren(body.ownerDocument.win.createEl('pre', { text: t('算法语法错误：') + String(error instanceof Error ? error.message : error) }));
}
export function algorithmRecord(host: HTMLElement, record: SourceRecord, lineNumbers: boolean, name = t('算法')) {
    if (editorFragment(host) && (!host.closest('[contenteditable="false"]') || nativeCalloutBodyInteraction(host))) return;
    if (record.algorithmError) { algorithmError(host, record.algorithmError); return; }
    if (!record.algorithm) return;
    const caption = host.matches('.callout') ? host.querySelector<HTMLElement>(':scope > .callout-title > .callout-title-inner') || undefined : undefined;
    renderAlgorithm(host, record.algorithm, record.number, lineNumbers, caption, name);
    host.dataset.anLine = String(record.line);
}
export function algorithmProcessor(source: string, host: HTMLElement, lineNumbers: boolean) {
    host.classList.add('an-algorithm-fence');
    try { renderAlgorithm(host, parseAlgorithm(source), '', lineNumbers); } catch (error) { algorithmError(host, error); }
}
export async function finishAlgorithms(root: HTMLElement) {
    const hosts = [...(root.matches('.an-algorithm') ? [root] : []), ...root.querySelectorAll<HTMLElement>('.an-algorithm')];
    await Promise.all(hosts.map(host => pending.get(host)).filter((work): work is Promise<void> => !!work));
}
