export interface FigureLayout { columns: 'auto' | 1 | 2 | 3 | 4; height?: number }
const pendingImages = new WeakSet<HTMLImageElement>();
function groupImages(box: HTMLElement) { return [...box.querySelectorAll<HTMLImageElement>(':scope > .an-figure-grid .callout:is([data-callout="subfigure"],[data-callout="subfig"]) img')]; }
export function updateFigureImageRatio(box: HTMLElement) {
    const ratios = groupImages(box).filter(img => img.naturalWidth && img.naturalHeight).map(img => img.naturalWidth / img.naturalHeight);
    box.style.setProperty('--an-max-image-ratio', String(ratios.length ? Math.max(...ratios) : 1));
}

/** Layout tokens coexist with the existing manual-number / suppression token. */
export function figureMetadata(metadata: string): { numbering: string; layout: FigureLayout } {
    const layout: FigureLayout = { columns: 'auto' };
    const numbering = metadata.split(/\s+/).filter(token => {
        if (token.startsWith('cols=')) {
            const value = token.slice(5);
            if (/^[1-4]$/.test(value)) layout.columns = Number(value) as 1 | 2 | 3 | 4;
            return false;
        }
        if (token.startsWith('height=')) {
            const value = token.slice(7);
            if (/^\d+(?:px)?$/.test(value)) {
                const height = parseInt(value, 10);
                if (height >= 16 && height <= 1200) layout.height = height;
            }
            return false;
        }
        return true;
    }).join(' ');
    return { numbering: numbering || (metadata.trim() ? 'auto' : ''), layout };
}

export function applyFigureLayout(box: HTMLElement, count: number, layout: FigureLayout = { columns: 'auto' }) {
    const columns = layout.columns === 'auto' ? (count === 4 ? 4 : Math.min(3, Math.max(1, count))) : layout.columns;
    for (let n = 1; n <= 4; n++) box.classList.toggle('an-columns-' + n, n === columns);
    box.classList.toggle('an-uniform-height', !!layout.height);
    if (layout.height) box.style.setProperty('--an-subfigure-height', layout.height + 'px');
    else box.style.removeProperty('--an-subfigure-height');
    if (!layout.height) return;
    updateFigureImageRatio(box);
    for (const img of groupImages(box)) if (!pendingImages.has(img)) {
        pendingImages.add(img);
        img.addEventListener('load', () => updateFigureImageRatio(box));
    }
}
