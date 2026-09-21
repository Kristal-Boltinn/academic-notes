import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

// Use the same flattened CSS in styles.css and the standalone PDF snapshot.
export async function compileStyle(path) {
  const source = await readFile(path, 'utf8');
  const settings = source.match(/\/\* @settings[\s\S]*?\*\//)?.[0] || '';
  const { code } = await transform(source, { loader: 'css', target: 'chrome120', legalComments: 'inline' });
  return (settings ? settings + '\n' : '') + code;
}
