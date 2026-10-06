/** Settings contain plain data; environment definitions cannot inject CSS or HTML. */
export const ENVIRONMENT_STYLES = ['thm', 'def', 'lem', 'prop', 'cor', 'claim', 'example', 'remark'] as const;
export interface CustomEnvironment {
    name: string;
    abbr: string;
    style: typeof ENVIRONMENT_STYLES[number];
    numbered: boolean;
    light?: string;
    dark?: string;
}
export interface ReferenceOverride { name?: string; abbr?: string; format?: string }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validEnvironmentKey(key: string, reserved: string[]) {
    return /^[a-z][a-z0-9-]{0,39}$/.test(key) && !reserved.includes(key) && !['constructor', 'prototype', '__proto__'].includes(key);
}
export function readEnvironments(raw: string, reserved: string[]): Record<string, CustomEnvironment> {
    const result: Record<string, CustomEnvironment> = {};
    try {
        if (raw.length > 60000) return result;
        const data: unknown = JSON.parse(raw);
        if (!object(data)) return result;
        for (const [key, entry] of Object.entries(data).slice(0, 64)) {
            if (!validEnvironmentKey(key, reserved) || !object(entry) || typeof entry.name !== 'string' || !entry.name.trim()) continue;
            const style = ENVIRONMENT_STYLES.includes(entry.style as CustomEnvironment['style']) ? entry.style as CustomEnvironment['style'] : 'thm';
            const clean: CustomEnvironment = { name: entry.name.trim().slice(0, 100), abbr: typeof entry.abbr === 'string' ? entry.abbr.trim().slice(0, 100) || key : key, style, numbered: entry.numbered !== false };
            for (const mode of ['light', 'dark'] as const) if (typeof entry[mode] === 'string' && /^#[0-9a-f]{6}$/i.test(entry[mode])) clean[mode] = entry[mode];
            result[key] = clean;
        }
    } catch { /* Invalid local settings use the built-in environments. */ }
    return result;
}
export function readReferenceOverrides(raw: string, keys: string[]): Record<string, ReferenceOverride> {
    const result: Record<string, ReferenceOverride> = {};
    try {
        if (raw.length > 60000) return result;
        const data: unknown = JSON.parse(raw);
        if (!object(data)) return result;
        for (const key of keys) {
            const entry = data[key]; if (!object(entry)) continue;
            const clean: ReferenceOverride = {};
            for (const field of ['name', 'abbr', 'format'] as const) if (typeof entry[field] === 'string' && entry[field].trim()) clean[field] = entry[field].trim().slice(0, field === 'format' ? 500 : 100);
            result[key] = clean;
        }
    } catch { /* Invalid local settings use default reference text. */ }
    return result;
}
