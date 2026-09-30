/** Serialized into isolated Chromium. Keep this function independent of imports. */
export function prepareMediaForPrint() {
    const pageHeight = (297 - 18 - 20) * 96 / 25.4 - 24;
    const groups = [...document.querySelectorAll<HTMLElement>('.callout:is([data-callout="figure"],[data-callout="fig"]),.an-diagram-figure,.block-language-tikz')].filter(el => !el.parentElement?.closest('.callout:is([data-callout="figure"],[data-callout="fig"])'));
    let scaled = 0, oversized = 0;
    for (const group of groups) {
        group.classList.add('an-print-figure');
        // Printed blocks retain source order: picture first, caption second.
        for (const box of [group, ...group.querySelectorAll<HTMLElement>('.callout:is([data-callout="subfigure"],[data-callout="subfig"])')]) {
            if (!box.matches('.callout')) continue;
            box.classList.add('an-print-figure');
            const title = box.querySelector(':scope > .callout-title'); if (title) box.appendChild(title);
        }
        const computed = getComputedStyle(group), limit = Math.max(100, pageHeight - (parseFloat(computed.marginTop) || 0) - (parseFloat(computed.marginBottom) || 0));
        let changed = false;
        for (let attempt = 0; attempt < 10 && group.getBoundingClientRect().height > limit; attempt++) {
            const factor = Math.min(.9, limit / group.getBoundingClientRect().height);
            const visuals = [...group.querySelectorAll<HTMLElement>('img,svg')].filter(el => !el.parentElement?.closest('svg,mjx-container'));
            if (!visuals.length) break;
            for (const visual of visuals) {
                const rect = visual.getBoundingClientRect();
                // Print-only inline priorities override captured embed dimensions,
                // including themes' height:auto and uniform-height image rules.
                visual.style.setProperty('width', rect.width * factor + 'px', 'important');
                visual.style.setProperty('height', rect.height * factor + 'px', 'important');
            }
            const shared = parseFloat(getComputedStyle(group).getPropertyValue('--an-subfigure-height'));
            if (shared) group.style.setProperty('--an-subfigure-height', shared * factor + 'px');
            changed = true;
        }
        if (changed) scaled++;
        if (group.getBoundingClientRect().height > limit) { group.classList.add('an-print-oversized'); oversized++; }
    }
    for (const image of document.querySelectorAll<HTMLImageElement>('img')) {
        if (image.closest('.an-print-figure')) continue;
        const rect = image.getBoundingClientRect();
        if (rect.height > pageHeight) {
            const factor = pageHeight / rect.height;
            image.style.setProperty('width', rect.width * factor + 'px', 'important');
            image.style.setProperty('height', pageHeight + 'px', 'important'); scaled++;
        }
        const paragraph = image.closest('p');
        if (paragraph && !paragraph.textContent?.trim() && paragraph.querySelectorAll('img').length === 1) paragraph.classList.add('an-print-image');
    }
    return { groups: groups.length, scaled, oversized };
}
