import esbuild from 'esbuild';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { compileStyle } from './scripts/styles.mjs';

const options = {
  entryPoints: ['src/main.ts'], bundle: true, outfile: 'main.js',
  format: 'cjs', platform: 'node', target: 'es2022',
  external: ['obsidian', 'electron', '@electron/remote', '@codemirror/*', '@lezer/*'],
  plugins: [{ name: 'snapshot-css', setup(build) {
    build.onLoad({ filter: /\.css$/ }, async ({ path }) => ({ contents: await compileStyle(path), loader: 'text' }));
  } }], logLevel: 'info', legalComments: 'eof',
  banner: { js: '/* Academic Notes 2.7.1 | MIT | generated from src/main.ts */' }
};
const licenseFiles = (await readdir('licenses')).sort();
options.footer = { js: '/*! Bundled dependency licenses\n' +
  (await Promise.all(licenseFiles.map(async file => '\n' + file + '\n' + await readFile('licenses/' + file, 'utf8')))).join('\n') + '\n*/' };
async function buildStyles() {
  const files = ['src/styles/callouts.css', 'snippets/academic-layout.css', 'src/styles/ui.css'];
  await writeFile('styles.css', (await Promise.all(files.map(compileStyle))).join('\n'));
}
await buildStyles();
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
  const { watch } = await import('node:fs');
  for (const dir of ['src/styles', 'snippets']) watch(dir, () => buildStyles().catch(console.error));
} else await esbuild.build(options);
