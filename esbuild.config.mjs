import esbuild from 'esbuild';
import { readFile, writeFile, readdir } from 'node:fs/promises';

const options = {
  entryPoints: ['src/main.ts'], bundle: true, outfile: 'main.js',
  format: 'cjs', platform: 'node', target: 'es2022',
  external: ['obsidian', 'electron', '@electron/remote', '@codemirror/*', '@lezer/*'],
  loader: { '.css': 'text' }, logLevel: 'info', legalComments: 'eof',
  banner: { js: '/* Academic Notes 2.2.2 | MIT | generated from src/main.ts */' }
};
const licenseFiles = (await readdir('licenses')).sort();
options.footer = { js: '/*! Bundled dependency licenses\n' +
  (await Promise.all(licenseFiles.map(async file => '\n' + file + '\n' + await readFile('licenses/' + file, 'utf8')))).join('\n') + '\n*/' };
async function buildStyles() {
  const files = ['src/styles/callouts.css', 'snippets/academic-layout.css'];
  await writeFile('styles.css', (await Promise.all(files.map(f => readFile(f, 'utf8')))).join('\n'));
}
await buildStyles();
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
  const { watch } = await import('node:fs');
  for (const dir of ['src/styles', 'snippets']) watch(dir, () => buildStyles().catch(console.error));
} else await esbuild.build(options);
