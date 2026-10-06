import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

// Use the same flattened CSS in styles.css and the standalone PDF snapshot.
export async function compileStyle(path) {
  let source = await readFile(path, 'utf8');
  if (source.includes('/* @academic-palette-presets */')) {
    const presets = JSON.parse(await readFile(new URL('../src/styles/palettes.json', import.meta.url), 'utf8'));
    const rules = Object.entries(presets).map(([key, preset]) => `body.theme-${preset.mode}[data-an-palette="${key}"] { ${Object.entries(preset.colors).map(([role,color]) => `--phb-${role}:${color};`).join('')} }`).join('\n');
    source = source.replace('/* @academic-palette-presets */', rules);
  }
  const settings = source.match(/\/\* @settings[\s\S]*?\*\//)?.[0] || '';
  const { code } = await transform(source, { loader: 'css', target: 'chrome120', legalComments: 'inline' });
  return (settings ? settings + '\n' : '') + code;
}
