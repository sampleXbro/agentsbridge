import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli/index.ts' },
  format: ['esm'],
  target: 'node20',
  clean: true,
  minify: false,
  sourcemap: true,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
  outDir: 'dist',
  splitting: false,
});
