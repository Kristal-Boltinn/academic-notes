import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import electron from 'electron';
await build({ entryPoints: ['tests/electron.ts'], outfile: '.test-build/electron.cjs', bundle: true,
  platform: 'node', target: 'es2022', format: 'cjs', external: ['electron', '@electron/remote', 'esbuild'] });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.test-build/electron.cjs'], { env, stdio: 'inherit', windowsHide: true });
const timer = setTimeout(() => child.kill(), 180000);
child.on('error', error => { console.error(error); clearTimeout(timer); process.exitCode = 1; });
child.on('exit', code => { clearTimeout(timer); process.exitCode = code ?? 1; });

