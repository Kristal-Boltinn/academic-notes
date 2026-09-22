import Engine from '../indexing/engine';

// Original monochrome vector drawings; masks inherit the selected motif color.
const drawing = (paths: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="black" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
export const MOTIFS = {
    laurel: drawing('<path d="M23 41C8 35 5 19 16 7M25 41C40 35 43 19 32 7M14 12Q5 12 9 20Q16 20 14 12M10 23Q2 25 10 31Q17 28 10 23M15 33Q10 40 20 40Q23 34 15 33M34 12Q43 12 39 20Q32 20 34 12M38 23Q46 25 38 31Q31 28 38 23M33 33Q38 40 28 40Q25 34 33 33"/><path d="M19 23l4 4 7-9M18 43l6-3 6 3"/>'),
    compass: drawing('<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="13" stroke-dasharray="1 4"/><path d="M24 3v6m0 30v6M3 24h6m30 0h6M30 15l-3 12-12 6 6-12zM21 21l6 6"/><circle cx="24" cy="24" r="2"/>'),
    rosette: drawing('<path d="M24 5C30 14 37 7 35 17C46 17 38 26 42 30C32 31 35 41 25 37C18 46 16 34 8 37C11 28 1 27 9 20C5 12 18 16 17 7Z"/><circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="5"/><path d="M21 24l2 2 4-5"/>'),
    orbit: drawing('<circle cx="24" cy="24" r="3"/><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(-35 24 24)"/><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(35 24 24)"/><ellipse cx="24" cy="24" rx="8" ry="20"/><circle cx="39" cy="12" r="2" fill="black"/>'),
    lattice: drawing('<path d="M24 4l17 10v20L24 44 7 34V14ZM7 14l17 10 17-10M24 24v20M24 4v20M7 34l17-10 17 10"/><path d="M15 9v20l17 10M33 9v20L16 39M7 24l17 10 17-10"/>'),
    knot: drawing('<path d="M24 6C11-5 0 14 13 23l12 10C38 44 49 25 36 16L24 6ZM24 42C37 53 48 34 35 25L23 15C10 4-1 23 12 32l12 10Z" transform="translate(5 5) scale(.79)"/><path d="M16 18l16 12M16 30l16-12"/>'),
    arch: drawing('<path d="M7 41h34M10 37V23a14 14 0 0128 0v14M15 37V23a9 9 0 0118 0v14M19 37V24a5 5 0 0110 0v13M8 37h9m14 0h9M24 5v5M13 10l4 5m18-5l-4 5M8 20l7 2m25-2l-7 2"/>'),
    quill: drawing('<path d="M8 41l24-27M13 34C7 17 27 5 41 6C39 22 29 35 13 34ZM20 27l-2-10m9 2l-1-9M20 27l12-1M27 19l10-1M8 42h19"/><path d="M32 36h8m-6 4h8"/>'),
    folio: drawing('<path d="M24 12C18 7 11 8 5 10v27c7-2 13-1 19 3 6-4 12-5 19-3V10c-6-2-13-3-19 2ZM24 12v28M9 15c4-1 7 0 11 2M9 21c4-1 7 0 11 2M9 27c4-1 7 0 11 2M28 17c4-2 7-3 11-2M28 23c4-2 7-3 11-2M28 29c4-2 7-3 11-2"/>')
};
export type AppearanceEntry = { light?: string; dark?: string; motifLight?: string; motifDark?: string; motif?: string };
export type CustomAppearance = Record<string, AppearanceEntry>;
export function parseAppearance(raw: string): CustomAppearance {
    const result: CustomAppearance = {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return result;
        for (const key of Object.keys(Engine.TYPES)) {
            const entry = (parsed as Record<string, unknown>)[key];
            if (!entry || typeof entry !== 'object') continue;
            const clean: AppearanceEntry = {};
            for (const field of ['light', 'dark', 'motifLight', 'motifDark'] as const) {
                const color = (entry as Record<string, unknown>)[field];
                if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) clean[field] = color;
            }
            const motif = (entry as Record<string, unknown>).motif;
            if (typeof motif === 'string' && (Object.hasOwn(MOTIFS, motif) || motif === 'none')) clean.motif = motif;
            result[key] = clean;
        }
    } catch { /* Invalid local settings fall back to the selected palette. */ }
    return result;
}
export function motifMask(id: string) { return Object.hasOwn(MOTIFS, id) ? `url("data:image/svg+xml,${encodeURIComponent(MOTIFS[id as keyof typeof MOTIFS])}")` : 'none'; }
export function titleInk(hex: string) {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    return luminance > .179 ? '#000000' : '#ffffff';
}
export const appearanceVariables = Object.keys(Engine.TYPES).flatMap(key => ['color', 'ink', 'motif-color', 'symbol', 'motif-display'].map(part => `--an-${part}-${key}`));
export function appearanceValues(raw: string, dark: boolean): Record<string, string> {
    const values: Record<string, string> = {};
    for (const [key, entry] of Object.entries(parseAppearance(raw))) {
        const color = dark ? entry.dark : entry.light, motifColor = dark ? entry.motifDark : entry.motifLight;
        if (color) { values[`--an-color-${key}`] = color; values[`--an-ink-${key}`] = titleInk(color); }
        if (motifColor) values[`--an-motif-color-${key}`] = motifColor;
        if (entry.motif) { values[`--an-symbol-${key}`] = motifMask(entry.motif); values[`--an-motif-display-${key}`] = entry.motif === 'none' ? 'none' : 'block'; }
    }
    return values;
}
