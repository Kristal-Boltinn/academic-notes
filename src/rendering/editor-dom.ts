/** A rendered callout can still belong to the native Live Preview editor. */
export function editorFragment(node: HTMLElement) {
    return !!node.closest('.cm-editor,.cm-content,.markdown-source-view,[contenteditable="true"],[contenteditable="plaintext-only"]') || node.isContentEditable;
}

/** Native selection can outlive contenteditable/focus changes on mobile WebKit. */
export function nativeEditorInteraction(node: HTMLElement) {
    if (!editorFragment(node)) return false;
    const scope = node.closest<HTMLElement>('.callout') || node;
    if (scope.isContentEditable || scope.querySelector('[contenteditable="true"],[contenteditable="plaintext-only"]')) return true;
    const active = node.ownerDocument.activeElement;
    if (active?.matches('input,textarea,select') && scope.contains(active)) return true;
    const selection = node.ownerDocument.getSelection();
    return !!selection && !!(selection.anchorNode && scope.contains(selection.anchorNode) || selection.focusNode && scope.contains(selection.focusNode));
}

/** Some native callouts keep an editable title even when its body is read-only.
 * Body layout may resume once focus and the native caret have left the callout. */
export function nativeCalloutBodyInteraction(node: HTMLElement) {
    if (!editorFragment(node)) return false;
    const scope = node.closest<HTMLElement>('.callout') || node;
    if (scope.isContentEditable) return true;
    const title = scope.querySelector(':scope > .callout-title');
    for (const editable of scope.querySelectorAll('[contenteditable="true"],[contenteditable="plaintext-only"],input,textarea,select'))
        if (!title?.contains(editable)) return true;
    const active = scope.ownerDocument.activeElement;
    if (active && scope.contains(active) && (active.matches('input,textarea,select') || (active as HTMLElement).isContentEditable)) return true;
    const selection = scope.ownerDocument.getSelection();
    return !!selection && !!(selection.anchorNode && scope.contains(selection.anchorNode) || selection.focusNode && scope.contains(selection.focusNode));
}

/** Let finger scrolling settle before changing editor widget heights or decorations. */
export function editorIdleScheduler(root: HTMLElement, work: () => void, delay = 30) {
    const doc = root.ownerDocument, win = doc.defaultView!;
    let timer: number | undefined, disposed = false, quietUntil = 0, touches = 0;
    const pointers = new Set<number>();
    const schedule = (wait = delay) => {
        if (disposed) return;
        win.clearTimeout(timer);
        timer = win.setTimeout(() => {
            timer = undefined;
            if (disposed || pointers.size || touches) return;
            const remaining = quietUntil - Date.now();
            if (remaining > 0) { schedule(remaining); return; }
            work();
        }, wait);
    };
    const down = (event: PointerEvent) => {
        if (event.pointerType === 'touch' || event.pointerType === 'pen') { pointers.add(event.pointerId); win.clearTimeout(timer); timer = undefined; }
    };
    const up = (event: PointerEvent) => {
        if (pointers.delete(event.pointerId) && !pointers.size) { quietUntil = Date.now() + 180; schedule(180); }
    };
    const scroll = () => { quietUntil = Date.now() + 180; schedule(180); };
    const touch = (event: TouchEvent) => {
        if (event.type !== 'touchstart' && !touches) return;
        touches = event.touches.length;
        if (touches) { win.clearTimeout(timer); timer = undefined; }
        else { quietUntil = Date.now() + 180; schedule(180); }
    };
    const blur = () => { pointers.clear(); touches = 0; schedule(); };
    root.addEventListener('pointerdown', down, { passive: true, capture: true });
    doc.addEventListener('pointerup', up, { passive: true, capture: true });
    doc.addEventListener('pointercancel', up, { passive: true, capture: true });
    root.addEventListener('scroll', scroll, { passive: true, capture: true });
    root.addEventListener('touchstart', touch, { passive: true, capture: true });
    doc.addEventListener('touchend', touch, { passive: true, capture: true });
    doc.addEventListener('touchcancel', touch, { passive: true, capture: true });
    win.addEventListener('blur', blur);
    return { schedule, isIdle: () => !disposed && !pointers.size && !touches && Date.now() >= quietUntil, dispose() {
        disposed = true; win.clearTimeout(timer); pointers.clear();
        root.removeEventListener('pointerdown', down, true); doc.removeEventListener('pointerup', up, true); doc.removeEventListener('pointercancel', up, true);
        root.removeEventListener('scroll', scroll, true); win.removeEventListener('blur', blur);
        root.removeEventListener('touchstart', touch, true); doc.removeEventListener('touchend', touch, true); doc.removeEventListener('touchcancel', touch, true);
    } };
}
