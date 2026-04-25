import { defineConfig } from 'tsup';

/**
 * Build config — two distinct artifact families:
 *
 * 1. **CLI binary** (`dist/cli.js`) — minified with `keepNames` so stack
 *    traces and error messages still reference real function/class names.
 *    Distributed globally (`npm install -g agentsmesh`) where install size
 *    and cold-start cost matter for end users.
 *
 * 2. **Library entrypoints** (`dist/{index,engine,canonical,targets}.js`) —
 *    unminified. These are imported into downstream apps whose bundlers
 *    minify their own output; shipping unminified library code keeps it
 *    debuggable when consumers step into it. Standard convention for
 *    published TS libraries (React, Vue, Vitest, tsup itself).
 *
 * Sourcemap policy:
 * - **CLI**: no sourcemap. With `keepNames` the minified stack traces still
 *   reference real function/class names, which is what end users report in
 *   bug threads. Shipping a 1.6 MB sourcemap for every install is dead weight
 *   for the 99% of users who never debug into CLI internals. Maintainers
 *   reproduce locally with sourcemap on.
 * - **Library entries**: sourcemap shipped. Consumers (IDE extensions, MCP
 *   servers, CI tools) often step into library code from their own debugger;
 *   sourcemaps make that experience usable. The cost is small relative to
 *   each consumer's own bundle.
 */

export default defineConfig([
  {
    entry: { cli: 'src/cli/index.ts' },
    format: ['esm'],
    target: 'node20',
    clean: true,
    minify: true,
    keepNames: true,
    sourcemap: false,
    dts: false,
    banner: { js: '#!/usr/bin/env node' },
    outDir: 'dist',
    splitting: false,
    treeshake: true,
  },
  {
    entry: {
      index: 'src/public/index.ts',
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
    treeshake: true,
  },
]);
