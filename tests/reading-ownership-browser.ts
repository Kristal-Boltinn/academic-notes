import AcademicNotes from '../src/main';
import Engine from '../src/indexing/engine';
import { DEFAULTS } from '../src/settings';
import { layoutReadOnlyCallout, restoreParagraphs } from '../src/typography/dom';
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const settle = () => new Promise(resolve => setTimeout(resolve, 180));

/** Exercise the real postprocessor, not just its Live Preview adapter. */
export async function runReadingOwnershipRegressions() {
    const host = document.body.createDiv(); host.style.width = '520px';
    const box = host.createDiv({ cls: 'callout', attr: { 'data-callout': 'proof' } });
    const title = box.createDiv({ cls: 'callout-title' }).createDiv({ cls: 'callout-title-inner', text: 'Proof' });
    const text = 'A proof preserves its assumptions and uses the previous lemma. We choose an open set and establish the conclusion without changing the original text. '.repeat(5);
    const p = box.createDiv({ cls: 'callout-content' }).createEl('p', { text });
    const note = Engine.parse('live.md', '> [!proof]\n> ' + text), plugin = new AcademicNotes({} as any, {} as any);
    plugin.active = true; plugin.settings = { ...DEFAULTS, kpReading: true, kpLivePreview: true }; plugin.graph = Engine.graph([note]);
    const children: any[] = [];
    const ctx: any = { sourcePath: 'live.md', getSectionInfo: () => ({ lineStart: 0, lineEnd: 1 }), addChild: (child: any) => { children.push(child); child.onload(); } };
    try {
        plugin.postprocess(box, ctx); await settle(); await settle();
        check(!!p.querySelector('.an-kp-line'), 'Reading ownership fixture must first optimize a proof');
        const editor = document.body.createDiv({ cls: 'cm-content', attr: { contenteditable: 'true' } });
        box.contentEditable = 'false'; editor.appendChild(box);
        const lines = [...p.childNodes], first = title.firstChild!;
        title.contentEditable = 'true'; title.focus(); document.getSelection()!.setPosition(first, 0);
        let mutations = 0; const observer = new MutationObserver(records => { mutations += records.length; }); observer.observe(box, { attributes: true, childList: true, characterData: true, subtree: true });
        plugin.settings.kpReading = false;
        for (const layout of plugin.paragraphLayouts) layout.refresh();
        await settle();
        check(mutations === 0, 'A pending disabled reading controller must not unwrap a fragment moved into the editor');
        for (let n = 0; n < 4; n++) { for (const refresh of plugin.readers) refresh(); await settle(); }
        observer.disconnect();
        check(mutations === 0 && lines.every((node, index) => p.childNodes[index] === node), 'Reading refreshes must not unwrap or repaint an editor-owned Proof');
        check(document.getSelection()!.anchorNode === first && !plugin.paragraphLayouts.size, 'Reading controllers must detach without moving the native caret');
        const count = children.length; plugin.postprocess(box, ctx);
        check(children.length === count, 'Already-mounted editor fragments must not register reading controllers');
        title.blur(); title.removeAttribute('contenteditable'); document.getSelection()!.removeAllRanges();
        restoreParagraphs(box); check(layoutReadOnlyCallout(box).processed === 1, 'Only the guarded live renderer may optimize its inactive widget');
        for (const child of children) child.unload();
        check(!!p.querySelector('.an-kp-line'), 'Unloading an old reading child must not unwrap Live Preview layout');
        restoreParagraphs(box); editor.remove();
    } finally { document.getSelection()?.removeAllRanges(); for (const child of children) child.unload(); host.remove(); }
    return 'Real reading postprocessor ownership: no editor restoration, no caret mutation, dynamic attachment and clean handoff passed';
}
