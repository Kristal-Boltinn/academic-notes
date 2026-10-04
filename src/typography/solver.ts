/** Knuth–Plass paragraph optimization using measured boxes, flexible gaps and break penalties. */
export type KpItem =
    | { type: 'box'; width: number }
    | { type: 'glue'; width: number; stretch: number; shrink: number }
    | { type: 'penalty'; width: number; cost: number; flagged?: boolean };

export interface KpLine { from: number; to: number; ratio: number; final: boolean }
export interface KpSolution { lines: KpLine[]; demerits: number }

export const KP_FORCED = -10000;
export const KP_FORBIDDEN = 10000;
const MAX_ITEMS = 1200;
const MAX_CANDIDATES = 650;
const MAX_OPERATIONS = 200000;
const EPSILON = 1e-7;

interface Breakpoint {
    to: number;
    next: number;
    naturalEnd: number;
    cost: number;
    extraWidth: number;
    flagged: boolean;
    forced: boolean;
    final: boolean;
}
interface State {
    score: number;
    fitness: number;
    flagged: boolean;
    lineCount: number;
    line?: KpLine;
    previous?: State;
}

/**
 * Finds a minimum-demerit set of breaks. An infeasible or expensive paragraph returns null.
 * A two-element width array specifies the first line's width and the remaining lines' width.
 * finalReserve holds space for an end marker; emergencyStretch widens break tolerance.
 * Returned ratios always fill actual visible gaps; non-final lines stay justified.
 * Breakpoint glue is discarded; a selected penalty contributes its width only to that line.
 */
export function solveParagraph(items: KpItem[], width: number | number[], finalReserve = 0, emergencyStretch = 0): KpSolution | null {
    if (!Array.isArray(items) || !items.length || items.length > MAX_ITEMS) return null;
    const widths = typeof width === 'number' ? [width, width] : width;
    if (!Array.isArray(widths) || widths.length < 1 || widths.length > 2 ||
        [...widths].some(value => !Number.isFinite(value) || value <= 0)) return null;
    const firstWidth = widths[0], followingWidth = widths[1] ?? firstWidth;
    const widest = Math.max(firstWidth, followingWidth);
    if (!Number.isFinite(finalReserve) || finalReserve < 0 || finalReserve >= widest) return null;
    if (!Number.isFinite(emergencyStretch) || emergencyStretch < 0) return null;
    const sums = [0], stretches = [0], shrinks = [0], boxes = [0], ends = [0];
    let lastBox = -1;
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (!item || !Number.isFinite(item.width) || item.width < 0) return null;
        if (item.type === 'box') {
            if (item.width > widest + EPSILON) return null;
            lastBox = index;
        } else if (item.type === 'glue') {
            if (!Number.isFinite(item.stretch) || !Number.isFinite(item.shrink) ||
                item.stretch < 0 || item.shrink < 0 || item.shrink > item.width) return null;
        } else if (item.type === 'penalty') {
            if (!Number.isFinite(item.cost) || (item.flagged !== undefined && typeof item.flagged !== 'boolean')) return null;
        } else return null;
        sums.push(sums[index] + (item.type === 'penalty' ? 0 : item.width));
        stretches.push(stretches[index] + (item.type === 'glue' ? item.stretch : 0));
        shrinks.push(shrinks[index] + (item.type === 'glue' ? item.shrink : 0));
        boxes.push(boxes[index] + (item.type === 'box' ? 1 : 0));
        ends.push(lastBox + 1);
        if (![sums[index + 1], stretches[index + 1], shrinks[index + 1]].every(Number.isFinite)) return null;
    }
    if (lastBox < 0) return null;
    const nextContent = (index: number) => {
        while (index < items.length && items[index].type === 'glue') index++;
        return index;
    };
    const first = nextContent(0);
    const points: Breakpoint[] = [{ to: first, next: first, naturalEnd: first, cost: 0, extraWidth: 0, flagged: false, forced: false, final: false }];
    for (let index = first; index < items.length; index++) {
        const item = items[index];
        if (item.type === 'glue' && index < lastBox && items[index - 1]?.type === 'box') {
            points.push({ to: index, next: nextContent(index + 1), naturalEnd: ends[index], cost: 0, extraWidth: 0, flagged: false, forced: false, final: false });
        } else if (item.type === 'penalty' && item.cost < KP_FORBIDDEN && (index < lastBox || item.cost <= KP_FORCED)) {
            const final = index > lastBox;
            points.push({ to: index + 1, next: nextContent(index + 1), naturalEnd: ends[index], cost: item.cost, extraWidth: item.width, flagged: item.flagged === true, forced: item.cost <= KP_FORCED, final });
            if (final) break;
        }
        if (points.length > MAX_CANDIDATES) return null;
    }
    if (!points.at(-1)!.final) points.push({ to: items.length, next: items.length, naturalEnd: lastBox + 1, cost: 0, extraWidth: 0, flagged: false, forced: true, final: true });
    if (points.length > MAX_CANDIDATES) return null;
    const states: (State | undefined)[][] = [[undefined, { score: 0, fitness: 1, flagged: false, lineCount: 0 }, undefined, undefined]];
    let mandatory = 0, operations = 0;
    for (let end = 1; end < points.length; end++) {
        const point = points[end];
        const best = new Array<State | undefined>(4);
        for (let start = end - 1; start >= mandatory; start--) {
            if (++operations > MAX_OPERATIONS) return null;
            const from = points[start].next, naturalEnd = point.naturalEnd;
            if (from >= naturalEnd || boxes[naturalEnd] === boxes[from]) continue;
            const natural = sums[naturalEnd] - sums[from] + point.extraWidth;
            const shrink = shrinks[naturalEnd] - shrinks[from];
            // Minimum possible line length increases as we look farther back.
            if (natural - shrink > widest + EPSILON) break;
            const visibleStretch = stretches[naturalEnd] - stretches[from];
            const stretch = visibleStretch + emergencyStretch;
            for (const previous of states[start]) {
                if (!previous) continue;
                if (++operations > MAX_OPERATIONS) return null;
                const target = (previous.lineCount === 0 ? firstWidth : followingWidth) - (point.final ? finalReserve : 0);
                if (target <= 0) continue;
                const difference = target - natural;
                let ratio = 0;
                if (difference < -EPSILON) {
                    if (shrink <= 0) continue;
                    ratio = difference / shrink;
                } else if (!point.final && difference > EPSILON) {
                    // Never accept a short indivisible unit with no gap to justify.
                    if (visibleStretch <= 0) continue;
                    ratio = difference / stretch;
                }
                if (!Number.isFinite(ratio) || ratio < -1 - EPSILON || ratio > 2.5 + EPSILON) continue;
                ratio = Math.max(-1, Math.min(2.5, ratio));
                // Emergency tolerance affects feasibility only. Draw and score the
                // actual spacing so it cannot become invisible right-edge whitespace.
                if (!point.final && difference > EPSILON && emergencyStretch) ratio = difference / visibleStretch;
                const fitness = ratio < -.5 ? 0 : ratio <= .5 ? 1 : ratio <= 1 ? 2 : 3;
                const badness = 100 * Math.abs(ratio) ** 3;
                let demerits = (10 + badness) ** 2;
                if (point.cost >= 0) demerits += point.cost ** 2;
                else if (!point.forced) demerits -= point.cost ** 2;
                if (previous.lineCount && Math.abs(previous.fitness - fitness) > 1) demerits += 10000;
                if (previous.flagged && point.flagged) demerits += 10000;
                if (point.final && previous.lineCount && natural < target * .18) {
                    // Discourage a tiny final fragment without requiring it to be justified.
                    demerits += 1800 * (1 - natural / (target * .18));
                }
                const score = previous.score + demerits;
                if (!Number.isFinite(score)) continue;
                if (!best[fitness] || score < best[fitness].score) {
                    best[fitness] = { score, fitness, flagged: point.flagged, lineCount: previous.lineCount + 1,
                        line: { from, to: point.to, ratio, final: point.final }, previous };
                }
            }
        }
        states.push(best);
        if (point.forced) {
            if (!best.some(Boolean)) return null;
            mandatory = end;
        }
    }
    const finalStates = states.at(-1)!.filter((state): state is State => !!state);
    if (!finalStates.length) return null;
    const winner = finalStates.reduce((a, b) => a.score <= b.score ? a : b);
    const lines: KpLine[] = [];
    for (let node: State | undefined = winner; node?.line; node = node.previous) lines.push(node.line);
    lines.reverse();
    return { lines, demerits: winner.score };
}
