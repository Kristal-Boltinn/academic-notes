import test from 'node:test';
import assert from 'node:assert/strict';
import { KP_FORBIDDEN, KP_FORCED, solveParagraph, type KpItem } from '../src/typography/solver';

const box = (width: number): KpItem => ({ type: 'box', width });
const glue = (width = 3, stretch = 3, shrink = 1): KpItem => ({ type: 'glue', width, stretch, shrink });
const penalty = (cost: number, width = 0, flagged = false): KpItem => ({ type: 'penalty', width, cost, flagged });
function words(widths: number[]) { return widths.flatMap((width, index) => index ? [glue(), box(width)] : [box(width)]); }

test('KP optimizes complete paragraphs rather than choosing the fullest current line', () => {
    const items = words([16, 11, 16, 8, 13, 19, 10, 16, 16, 21, 23, 9]);
    const solution = solveParagraph(items, 60)!;
    assert.ok(solution);
    assert.deepEqual(solution.lines.map(line => [line.from, line.to]), [[0, 5], [6, 13], [14, 19], [20, 23]]);
    // Greedy fits four words on line one but leaves line two with ratio 2.
    // The global solution moves the fourth word to line two and lowers total demerits.
    const greedyRatios = [0, 2, 1 / 6, 0];
    const greedyDemerits = greedyRatios.reduce((sum, ratio) => sum + (10 + 100 * Math.abs(ratio) ** 3) ** 2, 20000);
    assert.ok(solution.demerits < greedyDemerits);
    for (const line of solution.lines) assert.ok(line.ratio >= -1 && line.ratio <= 2.5);
    assert.equal(solution.lines.at(-1)!.ratio, 0);
});

test('KP selected glue, trailing glue and penalty widths follow their boundary semantics', () => {
    const gaps = solveParagraph([glue(), box(10), glue(), box(10), glue(30, 0, 0)], 10)!;
    assert.deepEqual(gaps.lines, [{ from: 1, to: 2, ratio: 0, final: false }, { from: 3, to: 5, ratio: 0, final: true }]);
    const hyphen = solveParagraph([box(8), penalty(KP_FORCED, 2, true), box(10)], 10)!;
    assert.deepEqual(hyphen.lines.map(line => [line.from, line.to, line.ratio]), [[0, 2, 0], [2, 3, 0]]);
    assert.equal(solveParagraph([box(8), penalty(KP_FORCED, 3), box(10)], 10), null);
    assert.equal(solveParagraph([box(8), penalty(KP_FORBIDDEN, 100), box(2)], 10)!.lines.length, 1);
});

test('KP honors mandatory and forbidden breaks and supports first-line width', () => {
    assert.deepEqual(solveParagraph([box(10), penalty(KP_FORCED), box(10)], 10)!.lines.map(line => line.to), [2, 3]);
    assert.equal(solveParagraph([box(10), penalty(KP_FORBIDDEN), box(10)], 10), null);
    const indented = solveParagraph(words([10, 10, 10, 10]), [10, 36])!;
    assert.deepEqual(indented.lines.map(line => [line.from, line.to]), [[0, 1], [2, 7]]);
    assert.equal(indented.lines.at(-1)!.ratio, 0);
    const unflagged = solveParagraph([box(10), penalty(KP_FORCED), box(10), penalty(KP_FORCED), box(10)], 10)!;
    const flagged = solveParagraph([box(10), penalty(KP_FORCED, 0, true), box(10), penalty(KP_FORCED, 0, true), box(10)], 10)!;
    assert.equal(flagged.demerits - unflagged.demerits, 10000);
});

test('KP shrinks overshooting lines and permits a short CJK final line', () => {
    const shrinking = solveParagraph([box(5), glue(3, 2, 2), box(5)], 12)!;
    assert.equal(shrinking.lines.length, 1); assert.equal(shrinking.lines[0].ratio, -.5);
    const cjk = [box(10), glue(0, 1, 0), box(10), glue(0, 1, 0), box(10)];
    assert.deepEqual(solveParagraph(cjk, 20)!.lines.map(line => [line.from, line.to, line.ratio]), [[0, 3, 0], [4, 5, 0]]);
    assert.equal(solveParagraph([box(21)], 20), null);
});

test('KP rejects invalid measurements and bounds pathological paragraphs', () => {
    for (const items of [[], [box(NaN)], [box(-1)], [glue(0, Infinity)], [glue(1, 1, 2)], [penalty(Infinity)]]) assert.equal(solveParagraph(items, 20), null);
    for (const width of [0, -1, NaN, Infinity, [], new Array<number>(1), [20, NaN], [20, 20, 20]]) assert.equal(solveParagraph([box(1)], width), null);
    assert.equal(solveParagraph(Array.from({ length: 1201 }, () => box(0)), 20), null);
    // Zero-size material creates a dense graph of plausible breaks; the work budget must stop it.
    const dense = Array.from({ length: 1199 }, (_, index) => index % 2 ? glue(0, 100, 0) : box(0));
    assert.equal(solveParagraph(dense, 20), null);
});
