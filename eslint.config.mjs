import obsidianmd from 'eslint-plugin-obsidianmd';
export default [
  { ignores: ['main.js', 'output/**', 'dist/**', '.test-build/**'] },
  ...obsidianmd.configs.recommended,
  { files: ['src/**/*.ts'], rules: { 'obsidianmd/ui/sentence-case': ['warn', { brands: ['Academic Notes', 'Obsidian', 'Electron', 'Python'] }] }, languageOptions: { parserOptions: { project: './tsconfig.json' } } }
];
