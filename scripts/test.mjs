import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
await build({ entryPoints: ['tests/regression.ts'], outfile: '.test-build/regression.cjs', bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  loader: { '.css': 'text' }, external: ['electron', '@electron/remote', '@codemirror/*'],
  plugins: [{ name: 'obsidian-test-host', setup(build) { build.onResolve({ filter: /^obsidian$/ }, () => ({ path: resolve('tests/obsidian-mock.ts') })); } }]
});
const result = spawnSync(process.execPath, ['--test', '.test-build/regression.cjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
