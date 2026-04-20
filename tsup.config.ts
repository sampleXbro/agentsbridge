import { defineConfig } from 'tsup';

export default defineConfig([
  {
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
  },
  {
    entry: {
      engine: 'src/public/engine.ts',
      canonical: 'src/public/canonical.ts',
      targets: 'src/public/targets.ts',
    },
    format: ['esm'],
    target: 'node20',
    clean: false,
    minify: false,
    sourcemap: true,
    dts: true,
    outDir: 'dist',
    splitting: false,
  },
]);
