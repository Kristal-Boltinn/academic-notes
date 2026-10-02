import { build } from 'esbuild';
import { resolve } from 'node:path';

// Bundle the same local implementation for the sandboxed print window. It
// cannot import modules, read files or execute document-provided scripts.
export const typographyClient = {
  name: 'academic-typography-client',
  setup(builder) {
    builder.onResolve({ filter: /^academic-typography-client$/ }, () => ({ path: 'client', namespace: 'academic-typography' }));
    builder.onLoad({ filter: /.*/, namespace: 'academic-typography' }, async () => {
      const result = await build({ entryPoints: [resolve('src/typography/dom.ts')], bundle: true, write: false,
        format: 'iife', globalName: 'AcademicParagraphLayout', platform: 'browser', target: 'es2022', minify: true, metafile: true });
      return { contents: result.outputFiles[0].text, loader: 'text', watchFiles: Object.keys(result.metafile.inputs).map(file => resolve(file)) };
    });
  }
};
