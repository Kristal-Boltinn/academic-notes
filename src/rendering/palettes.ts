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
export function paletteValues(settings: PaletteSettings, mode: PaletteMode) {
    const overrides=paletteOverrides(settings)[selectedPalette(settings,mode)] || {};
    return appearanceValues(JSON.stringify(overrides),mode==='dark',Object.keys(appearanceRoles(settings)));
}
export function defaultRoleColor(settings: PaletteSettings, palette: string, key: string) {
    const env=Engine.environments(settings)[key], role=roleBase[env?.style || key] || env?.style || key;
    return PRESETS[basePalette(settings,palette)]?.colors[role] || '#286b76';
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
