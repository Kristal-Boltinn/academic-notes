import Engine from './indexing/engine';
export const DEFAULTS = { ...Engine.DEFAULTS, tocDepth: 3, exportFolder: '_exports',
    livePreview: true, lightPalette: 'forest', darkPalette: 'radiation', neutralBody: false, hideMotif: false,
    captureTheme: true, openPdf: true, exportNumbering: 'chapter-section', excludedFolders: '', indexDelay: 450 };
export type AcademicSettingsData = typeof DEFAULTS;
