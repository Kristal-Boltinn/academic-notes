import { LayoutRecorder, traceLayout } from '../src/diagnostics/layout';
import { layoutParagraphs, restoreParagraphs } from '../src/typography/dom';
import AcademicNotes from '../src/main';
import { DEFAULTS } from '../src/settings';
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const settle = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));
export async function runLayoutDiagnosticRegressions() {
    const secret = 'PERSONAL-NOTE-CONTENT-DO-NOT-EXPORT', host = document.body.createDiv({ cls: 'markdown-rendered cm-editor', attr: { 'data-path': secret + '.md', id: secret } });
    host.style.width = '520px';
    const scroll = host.createDiv({ cls: 'cm-scroller' }); scroll.style.cssText = 'display:block;height:240px;overflow:auto;font:17px/28px Arial,sans-serif';
    const box = scroll.createDiv({ cls: 'callout', attr: { 'data-callout': 'proof' } });
    box.createDiv({ cls: 'callout-title' }).createDiv({ cls: 'callout-title-inner', text: 'Proof' });
    const p = box.createDiv({ cls: 'callout-content' }).createEl('p', { text: 'A diagnostic measures line rectangles while preserving original content without changing the note. '.repeat(8) + secret });
    p.style.cssText = 'text-indent:0;white-space:normal;line-height:28px';
    const math = p.createSpan({ cls: 'math', text: 'f(x)', attr: { 'aria-label': secret, 'data-source': '\\privateFormula' } });
    const meta = () => ({ pluginVersion: 'test', appVersion: 'test', ios: true, android: false, kpReading: true, kpLivePreview: true, livePreview: true });
    const checkpoints: any[] = []; let completed: any;
    const recorder = new LayoutRecorder(document, () => host, meta, { durationMs: 10000, sampleMs: 10000, checkpointMs: 30, onCheckpoint: report => checkpoints.push(report) });
    try {
        const before = p.outerHTML, caret = p.firstChild!; document.getSelection()!.setPosition(caret, 3);
        const first = recorder.report(); recorder.sample();
        check(p.outerHTML === before && document.getSelection()!.anchorNode === caret, 'Sampling must not change content or the native caret');
        check(first.samples[0].callouts[0].paragraphs[0].optimized === false && first.samples[0].callouts[0].paragraphs[0].nativeRects.length > 0, 'Native fallback must have measurable rectangles');
        const event = new Event('touchstart', { bubbles: true, cancelable: true }); Object.defineProperty(event, 'touches', { value: [{}] });
        check(p.dispatchEvent(event) && !event.defaultPrevented, 'Recording must not intercept native touch scrolling');
        const prevent = (e: Event) => e.preventDefault(); p.addEventListener('touchmove', prevent, { passive: false });
        p.dispatchEvent(new Event('touchmove', { bubbles: true, cancelable: true })); p.removeEventListener('touchmove', prevent);
        document.getSelection()!.removeAllRanges(); host.classList.remove('cm-editor');
        const fit = layoutParagraphs(box);
        check(fit.processed === 1, 'Diagnostic KP fixture must optimize: ' + JSON.stringify({ fit, width: p.getBoundingClientRect().width, title: box.querySelector('.callout-title')!.getBoundingClientRect().toJSON(), paragraph: p.getBoundingClientRect().toJSON(), css: getComputedStyle(p).font })); recorder.sample();
        p.classList.add('host-update'); await settle();
        for (let n = 0; n < 430; n++) traceLayout(box, 'live.paint', { n });
        for (let n = 0; n < 30; n++) recorder.sample();
        const optimized = recorder.report().samples.at(-1)!.callouts[0].paragraphs[0];
        check(optimized.optimized && optimized.rows.slice(0, -1).every(row => row.rightGap !== null && Math.abs(row.rightGap) < 2), 'Diagnostic rows must measure actual justified right edges');
        const report = recorder.stop(), serialized = JSON.stringify(report);
        check(!serialized.includes(secret) && !serialized.includes('privateFormula') && !serialized.includes('data-path') && !serialized.includes('aria-label'), 'Reports must exclude note text, formulas, DOM attributes and file names');
        check(report.counts['touchmove.prevented'] > 0, 'Recording must observe prevention by another handler after propagation');
        check(report.counts['dom.mutations'] > 0 && report.counts['kp.layout'] > 0, 'DOM and plugin work must be counted');
        check(report.events.length <= 400 && report.samples.length <= 24 && report.droppedEvents > 0 && report.droppedSamples > 0, 'Diagnostics must remain bounded');
        check(report.samples[0].ms === first.samples[0].ms && first.events.length === 0 && !first.counts['live.paint'], 'Keep the starting sample and immutable checkpoints');
        const count = report.events.length; p.dispatchEvent(new Event('touchend', { bubbles: true })); traceLayout(box, 'live.paint'); await settle();
        check(recorder.report().events.length === count && !recorder.running && checkpoints.length > 0, 'Stop must remove listeners/timers and unregister traces');
        const timed = new LayoutRecorder(document, () => host, meta, { durationMs: 30, sampleMs: 10, checkpointMs: 10, onFinish: report => { completed = report; } });
        await settle(100); check(!timed.running && completed && !completed.running, 'Automatic stop must produce a final report'); timed.stop();
        const saved: { path: string; report: ReturnType<LayoutRecorder['report']> }[] = [], folders = new Set<string>();
        const plugin = new AcademicNotes({ workspace: { getActiveViewOfType: () => ({ containerEl: host }) }, vault: { adapter: {
            exists: async (path: string) => folders.has(path), mkdir: async (path: string) => { folders.add(path); },
            write: async (path: string, content: string) => { await settle(5); saved.push({ path, report: JSON.parse(content) }); }
        } } } as any, { version: 'test' } as any);
        plugin.settings = { ...DEFAULTS }; plugin.active = true;
        await plugin.startLayoutDiagnostics();
        plugin.layoutDiagnostics!.options.onCheckpoint!(plugin.layoutDiagnostics!.report());
        await plugin.stopLayoutDiagnostics();
        check(saved.length === 3 && saved[0].report.running && !saved.at(-1)!.report.running && saved.every(s => s.path === plugin.layoutDiagnosticPath), 'Actual plugin commands must serialize initial, checkpoint and final vault writes');
        check(saved[0].path.startsWith('_exports/academic-layout-diagnostics-') && !JSON.stringify(saved).includes(secret), 'Reports must stay in the vault export folder and omit note content');
        check(p.querySelector('.math') === math, 'Original formula node must remain intact');
    } finally { recorder.stop(); document.getSelection()?.removeAllRanges(); restoreParagraphs(box); host.remove(); }
    return 'Local layout diagnostics: privacy, native/KP geometry, passive events, final prevention, immutable checkpoints, bounds and cleanup passed';
}
