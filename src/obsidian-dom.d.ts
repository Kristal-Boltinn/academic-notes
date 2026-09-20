// Obsidian installs these global helpers in each workspace window.
// Its current API types declare the globals but omit the Window members.
export {};
declare global {
    interface Window {
        createEl: typeof createEl;
        createSpan: typeof createSpan;
        createSvg: typeof createSvg;
    }
}
