import presets from '../styles/palettes.json';
import Engine from '../indexing/engine';
import { parseAppearance, appearanceValues, type CustomAppearance } from './custom-appearance';
import type { AcademicSettingsData } from '../settings';
export type PaletteMode = 'light' | 'dark';
export interface PaletteDefinition { name: string; mode: PaletteMode; base: string }
export type PaletteSettings = Pick<AcademicSettingsData, 'lightPalette' | 'darkPalette' | 'customAppearance' | 'customEnvironments' | 'customPalettes' | 'paletteAppearance'>;
export const PRESETS: Record<string, {name: string; mode: string; colors: Record<string,string>}> = presets;
export const roleBase: Record<string,string> = { axiom:'thm', hypothesis:'thm', assumption:'def', conjecture:'claim', exercise:'example', solution:'proof', remark:'def', algorithm:'def' };
export function appearanceRoles(settings: {customEnvironments?: string} = {}) {
    return {...Engine.APPEARANCE_TYPES, ...Object.fromEntries(Object.entries(Engine.environments(settings)).map(([key,entry])=>[key,[entry.name,key]]))};
}
export function customPalettes(raw: string): Record<string,PaletteDefinition> {
    const result: Record<string,PaletteDefinition> = {};
    try {
        if(raw.length>20000) return result;
        const data: unknown=JSON.parse(raw); if(!data || typeof data!=='object' || Array.isArray(data)) return result;
        for(const [key,value] of Object.entries(data).slice(0,32)) {
            if(!/^custom-[a-z0-9-]{1,40}$/.test(key) || !value || typeof value!=='object') continue;
            const entry=value as Record<string,unknown>, mode=entry.mode;
            if((mode!=='light'&&mode!=='dark') || typeof entry.name!=='string' || !entry.name.trim() || typeof entry.base!=='string' || (entry.base!=='theme' && PRESETS[entry.base]?.mode!==mode)) continue;
            result[key]={name:entry.name.trim().slice(0,100),mode,base:entry.base};
        }
    } catch { /* Invalid local palettes fall back to built-in presets. */ }
    return result;
}
export function paletteOptions(settings: {customPalettes: string}, mode: PaletteMode) {
    return { theme: 'theme', ...Object.fromEntries(Object.entries(PRESETS).filter(([,p])=>p.mode===mode).map(([key,p])=>[key,p.name])), ...Object.fromEntries(Object.entries(customPalettes(settings.customPalettes)).filter(([,p])=>p.mode===mode).map(([key,p])=>[key,p.name])) };
}
export function selectedPalette(settings: PaletteSettings, mode: PaletteMode) {
    const value=mode==='dark'?settings.darkPalette:settings.lightPalette;
    return Object.hasOwn(paletteOptions(settings,mode),value)?value:mode==='dark'?'radiation':'forest';
}
export function basePalette(settings: {customPalettes:string}, key: string) { return customPalettes(settings.customPalettes)[key]?.base || (Object.hasOwn(PRESETS,key)?key:'theme'); }
export function paletteOverrides(settings: PaletteSettings): Record<string,CustomAppearance> {
    const result: Record<string,CustomAppearance> = {};
    try {
        if(settings.paletteAppearance.length>600000) return result;
        const data: unknown=JSON.parse(settings.paletteAppearance);if(!data || typeof data!=='object' || Array.isArray(data)) return result;
        const allowed=['theme',...Object.keys(PRESETS),...Object.keys(customPalettes(settings.customPalettes))], roles=Object.keys(appearanceRoles(settings));
        for(const key of allowed) if(Object.hasOwn(data,key)) result[key]=parseAppearance(JSON.stringify((data as Record<string,unknown>)[key]),roles);
    } catch { /* Invalid overrides use each palette's own defaults. */ }
    return result;
}
// Theme palettes stay as CSS expressions, so changing the host accent updates
// every environment without storing or freezing a sampled theme color.
const themeMix: Record<string,[number,string]> = {
    def:[82,'#3e594c'], thm:[77,'#354d68'], lem:[80,'#605268'],
    prop:[75,'#686340'], cor:[85,'#3e645a'], claim:[79,'#495d73'],
    example:[70,'#886b45'], proof:[65,'#606862']
};
export function themeRoleValue(role: string, mode: PaletteMode) {
    const [weight,neutral]=themeMix[role] || themeMix.def;
    return `color-mix(in srgb, var(--text-accent, #247651) ${mode==='dark'?weight-16:weight}%, ${mode==='dark'?'#e0e5df':neutral})`;
}
export function defaultRoleValue(settings: PaletteSettings, palette: string, key: string, mode: PaletteMode) {
    const env=Engine.environments(settings)[key], role=roleBase[env?.style || key] || env?.style || key;
    return PRESETS[basePalette(settings,palette)]?.colors[role] || themeRoleValue(role,mode);
}
export function paletteValues(settings: PaletteSettings, mode: PaletteMode) {
    const palette=selectedPalette(settings,mode), overrides=paletteOverrides(settings)[palette] || {};
    // Inline defaults also protect the current selection from stale snippets.
    const colors=PRESETS[basePalette(settings,palette)]?.colors || Object.fromEntries(Object.keys(themeMix).map(role=>[role,themeRoleValue(role,mode)]));
    const defaults=Object.fromEntries(Object.entries(colors).map(([role,color])=>[`--phb-${role}`,color]));
    return {...defaults,...appearanceValues(JSON.stringify(overrides),mode==='dark',Object.keys(appearanceRoles(settings)))};
}
export function defaultRoleColor(settings: PaletteSettings, palette: string, key: string, mode: PaletteMode = PRESETS[basePalette(settings,palette)]?.mode === 'dark' ? 'dark' : 'light') {
    const value=defaultRoleValue(settings,palette,key,mode);
    if (value.startsWith('#')) return value;
    if (typeof document === 'undefined' || !document.body?.appendChild) return mode==='dark'?'#acc5b6':'#286b76';
    const probe=document.body.createSpan({attr:{hidden:''}}); probe.style.color=value;
    const resolved=probe.ownerDocument.defaultView!.getComputedStyle(probe).color; probe.remove();
    const context=document.win.createEl('canvas').getContext('2d');
    if (!context) return '#286b76';
    context.fillStyle=resolved; context.fillRect(0,0,1,1);
    return '#'+Array.from(context.getImageData(0,0,1,1).data).slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');
}
/** One-time migration attaches global colors only to the currently selected palettes. */
export function migratePaletteSettings(settings: AcademicSettingsData) {
    const before=JSON.stringify([settings.customAppearance,settings.customEnvironments,settings.paletteAppearance,settings.lightPalette,settings.darkPalette]);
    settings.lightPalette=selectedPalette(settings,'light');settings.darkPalette=selectedPalette(settings,'dark');
    const all=paletteOverrides(settings), old=parseAppearance(settings.customAppearance), defs=Engine.environments(settings);
    for(const [key,entry] of Object.entries(defs)) if(entry.light || entry.dark) old[key]={light:entry.light,dark:entry.dark};
    for(const mode of ['light','dark'] as const) {
        const palette=selectedPalette(settings,mode), profile=all[palette] || {};
        for(const [key,entry] of Object.entries(old)) {
            const moved: typeof entry={};
            for(const field of mode==='light'?['light','motifLight','motif'] as const:['dark','motifDark','motif'] as const) if(entry[field]) moved[field]=entry[field];
            if(Object.keys(moved).length) profile[key]={...moved,...profile[key]};
        }
        if(Object.keys(profile).length) all[palette]=profile;
    }
    for(const entry of Object.values(defs)) { delete entry.light;delete entry.dark; }
    if(Object.values(Engine.environments(settings)).some(entry=>entry.light||entry.dark)) settings.customEnvironments=JSON.stringify(defs);
    settings.customAppearance='{}';settings.paletteAppearance=JSON.stringify(all);
    return before!==JSON.stringify([settings.customAppearance,settings.customEnvironments,settings.paletteAppearance,settings.lightPalette,settings.darkPalette]);
}
