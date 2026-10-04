import { editorIdleScheduler } from '../src/rendering/editor-dom';
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const settle = () => new Promise(resolve => setTimeout(resolve, 240));
export async function runEditorIdleRegressions() {
    const host = document.body.createDiv(); let writes = 0;
    const idle = editorIdleScheduler(host, () => writes++);
    const touch = (type: string, count: number) => { const event = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(event, 'touches', { value: Array(count).fill({}) }); return event; };
    try {
        document.dispatchEvent(touch('touchend', 0)); await settle();
        check(writes === 0, 'A touch ending in another editor must not schedule layout');
        check(host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch' })), 'Finger input must remain native');
        check(host.dispatchEvent(touch('touchstart', 1)), 'Native touch scrolling must never be prevented');
        idle.schedule(); await settle(); check(writes === 0, 'No editor layout may run while touching');
        document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 11, pointerType: 'touch' }));
        for (let n = 0; n < 4; n++) { host.dispatchEvent(new Event('scroll')); idle.schedule(); }
        await settle(); check(writes === 0, 'Pointer cancellation must not release an ongoing native touch');
        document.dispatchEvent(touch('touchend', 0));
        for (let n = 0; n < 4; n++) host.dispatchEvent(new Event('scroll'));
        await settle(); check(writes === 1 && idle.isIdle(), 'Exactly one layout should resume after inertia settles');
        idle.schedule(); idle.dispose(); await settle(); check(writes === 1, 'Disposal must cancel work');
        host.dispatchEvent(touch('touchstart', 1)); document.dispatchEvent(touch('touchend', 0)); await settle();
        check(writes === 1, 'Disposed touch listeners must not restart layout');
    } finally { idle.dispose(); host.remove(); }
    return 'Editor idle scheduling: passive touch, cancelled pointers, momentum settling and cleanup passed';
}
