import type { Position } from './pdf-postprocess';
export interface FloatOptions { mode: 'off' | 'shrink-move' | 'move-shrink' | 'shrink' | 'move'; maxRounds: number }
export function normalizeFloatOptions(mode: string = 'off', maxRounds = 6): FloatOptions {
    return { mode: ['shrink-move', 'move-shrink', 'shrink', 'move'].includes(mode) ? mode as FloatOptions['mode'] : 'off', maxRounds: Number.isInteger(maxRounds) ? Math.max(1, Math.min(10, maxRounds)) : 6 };
}
/** Serialized into the isolated print window. Dependencies must stay inside it. */
export function createFloatLayout(options: FloatOptions) {
    const root = document.getElementById('phb-document')!;
    const backup = root.cloneNode(true);
    const template = root.querySelector<HTMLAnchorElement>('a.phb-probe');
    const report = { mode: options.mode, attempts: 0, shrunk: 0, moved: 0, skipped: 0, fallback: '' };
    const actions = options.mode === 'shrink-move' ? ['shrink', 'move'] : options.mode === 'move-shrink' ? ['move', 'shrink'] : options.mode === 'off' ? [] : [options.mode];
    let inactive = !template || !actions.length;
    if (!template && actions.length) report.fallback = 'missing-probes';
    type Block = { node: HTMLElement; start: string; end: string };
    type Candidate = { figure: Block; previous: Block; following: Block[]; done: boolean; action: number };
    type Trial = { candidate: Candidate; kind: string; moved: Block[]; next: Element | null; styles: [HTMLElement | SVGElement, string | null][]; before: Record<string, Position> };
    const blocks = new Map<HTMLElement, Block>(), accepted: Trial[] = [], candidates: Candidate[] = [];
    let pending: Trial | null = null, serial = 0;
    const plain = (node: Element | null): node is HTMLElement => !!node?.matches('p') && !!node.textContent?.trim() && !node.querySelector('img,.math-block,mjx-container[display="true"],.callout,table,pre,iframe');
    const block = (node: HTMLElement): Block => {
        if (blocks.has(node)) return blocks.get(node)!;
        const key = 'an-float-' + ++serial, value = { node, start: key + '-start', end: key + '-end' };
        node.classList.add('an-float-block');
        for (const [id, side] of [[value.start, 'start'], [value.end, 'end']]) {
            const probe = template!.cloneNode(true) as HTMLAnchorElement;
            probe.removeAttribute('id'); probe.href = 'https://phb-anchor.invalid/' + id;
            probe.classList.add('an-float-' + side); node.appendChild(probe);
        }
        blocks.set(node, value); return value;
    };
    if (!inactive) for (const figure of root.querySelectorAll<HTMLElement>('.callout:is([data-callout="figure"],[data-callout="fig"])')) {
        const previous = figure.previousElementSibling;
        if (!figure.parentElement?.matches('.phb-chapter') || figure.parentElement.closest('.callout,blockquote,li,table') || !plain(previous) || figure.classList.contains('an-print-oversized') || !figure.querySelector('img,svg') || getComputedStyle(figure).breakBefore === 'page') { report.skipped++; continue; }
        // Capture safe siblings before adding measurement links. Never cross a
        // heading, callout, list, table, image, or another figure.
        const following: HTMLElement[] = [];
        for (let next = figure.nextElementSibling; plain(next) && following.length < 3; next = next.nextElementSibling) following.push(next);
        figure.classList.add('an-float-figure');
        candidates.push({ figure: block(figure), previous: block(previous), following: following.map(block), done: false, action: 0 });
    }
    const samePage = (item: Block, positions: Record<string, Position>) => positions[item.start] && positions[item.end] && positions[item.start].page === positions[item.end].page;
    const valid = (trial: Trial, positions: Record<string, Position>) => {
        const { candidate: c } = trial, previous = positions[c.previous.end], picture = positions[c.figure.start];
        if (!previous || !picture || !samePage(c.figure, positions)) return false;
        return trial.kind === 'shrink' ? picture.page === previous.page : picture.page === previous.page + 1 && trial.moved.every(p => samePage(p, positions) && positions[p.start].page === previous.page);
    };
    const restore = (trial: Trial) => {
        const node = trial.candidate.figure.node;
        if (trial.next) trial.next.before(node); else node.parentElement!.appendChild(node);
        for (const [element, style] of trial.styles) { if (style === null) element.removeAttribute('style'); else element.setAttribute('style', style); }
    };
    const rollback = (reason: string) => {
        root.replaceWith(backup.cloneNode(true)); inactive = true; pending = null; accepted.length = 0;
        report.shrunk = report.moved = 0; report.fallback = reason;
        return { changed: true, report: { ...report } };
    };
    const step = (printed: Record<string, Position>) => {
        if (inactive) return { changed: false, report: { ...report } };
        let positions = printed, dirty = false;
        if (pending) {
            const trial = pending; pending = null;
            if (valid(trial, printed)) { accepted.push(trial); trial.candidate.done = true; if (trial.kind === 'shrink') report.shrunk++; else report.moved++; }
            else { restore(trial); positions = trial.before; dirty = true; }
        }
        for (const c of candidates) {
            if (c.done) continue;
            const previous = positions[c.previous.end], picture = positions[c.figure.start];
            if (!previous || !picture || !positions[c.figure.end]) return rollback('missing-measurements');
            if (!samePage(c.figure, positions) || picture.page !== previous.page + 1 || previous.y < 85) { c.done = true; continue; }
            while (c.action < actions.length) {
                const kind = actions[c.action++];
                const visuals = [...c.figure.node.querySelectorAll<HTMLElement | SVGElement>('img,svg')].filter(v => !v.parentElement?.closest('svg,mjx-container'));
                if (kind === 'shrink' && !visuals.length || kind === 'move' && !c.following.length) continue;
                if (report.attempts >= options.maxRounds) return rollback('round-limit');
                const trial: Trial = { candidate: c, kind, moved: [], next: c.figure.node.nextElementSibling, styles: [], before: positions };
                if (kind === 'shrink') {
                    trial.styles = [c.figure.node, ...visuals].map(element => [element, element.getAttribute('style')]);
                    for (const visual of visuals) {
                        const rect = visual.getBoundingClientRect();
                        visual.style.setProperty('width', rect.width * .8 + 'px', 'important');
                        visual.style.setProperty('height', rect.height * .8 + 'px', 'important');
                    }
                    const shared = parseFloat(getComputedStyle(c.figure.node).getPropertyValue('--an-subfigure-height'));
                    if (shared) c.figure.node.style.setProperty('--an-subfigure-height', shared * .8 + 'px');
                } else {
                    // PDF coordinates are points measured from the page bottom.
                    // Estimate a short prefix, then verify its actual printed
                    // page and both boundaries before retaining any movement.
                    const available = (previous.y - 20 * 72 / 25.4 - 12) * 96 / 72;
                    let height = 0;
                    for (const paragraph of c.following) {
                        const style = getComputedStyle(paragraph.node);
                        const extra = paragraph.node.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
                        if (height + extra > available && trial.moved.length) break;
                        trial.moved.push(paragraph); height += extra;
                        if (height > available) break;
                    }
                    trial.moved.at(-1)!.node.after(c.figure.node);
                }
                report.attempts++; pending = trial;
                return { changed: true, report: { ...report } };
            }
            c.done = true; report.skipped++;
        }
        return { changed: dirty, report: { ...report } };
    };
    return { step, rollback, validate: (positions: Record<string, Position>) => accepted.every(trial => valid(trial, positions)), report };
}
