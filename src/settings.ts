import Engine from './indexing/engine';
export const DEFAULTS = { ...Engine.DEFAULTS, tocDepth: 3, exportFolder: '_exports',
    livePreview: true, lightPalette: 'forest', darkPalette: 'radiation', neutralBody: false, hideMotif: false, customAppearance: '{}', customPalettes: '{}', paletteAppearance: '{}',
    captureTheme: true, openPdf: true, paragraphIndent: false, kpReading: false, kpLivePreview: false, kpPdf: false, pdfFloatMode: 'off', pdfFloatMaxRounds: 6, exportNumbering: 'chapter-section', excludedFolders: '', indexDelay: 450 };
export type AcademicSettingsData = typeof DEFAULTS;
