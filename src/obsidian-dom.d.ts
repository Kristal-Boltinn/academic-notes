// Obsidian installs these global helpers in each workspace window.
// Its current API types declare the globals but omit the Window members.
export {};
declare global {
    interface Window {
        createEl: typeof createEl;
        createDiv: typeof createDiv;
        createSpan: typeof createSpan;
        createSvg: typeof createSvg;
    }
}
