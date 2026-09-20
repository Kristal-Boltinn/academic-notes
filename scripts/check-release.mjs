import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const json = async f => JSON.parse(await readFile(f, 'utf8'));
const manifest = await json('manifest.json'), pkg = await json('package.json'), versions = await json('versions.json');
assert.equal(manifest.id, 'academic-notes'); assert.equal(manifest.isDesktopOnly, true);
assert.equal(manifest.version, pkg.version); assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.ok(manifest.description.length <= 250 && manifest.description.endsWith('.'));
for (const file of ['main.js', 'manifest.json', 'styles.css', 'package-lock.json', 'README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md']) await access(file);
const bundle = await readFile('main.js', 'utf8');
for (const forbidden of ['legacyCaptions', 'followPhycat', 'setup-pdf', 'findPython', 'runtime/export.py', "require(\"child_process\")"]) {
  assert.ok(!bundle.includes(forbidden), `Release still contains ${forbidden}`);
}
assert.ok(!/require\(["'](?:node:)?fs(?:\/promises)?["']\)/.test(bundle), 'Release must not use the Node filesystem API');
assert.ok(bundle.includes('printToPDF')); assert.ok(bundle.includes('PDFDocument'));
assert.ok((await readFile('styles.css', 'utf8')).includes('an-figure-grid'));
console.log('Three-file release, version metadata and removed-runtime checks passed.');
