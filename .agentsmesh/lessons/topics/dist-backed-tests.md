# Lessons: dist-backed tests

## Rules (apply unconditionally)
1. Run `pnpm build` before any targeted e2e or integration slice whenever source affecting `dist/cli.js` has changed; ad hoc `vitest` runs do not auto-build (Evidence L114, L116, L165).
2. Never run two CLI commands that read or rebuild `dist/` in parallel — serialize anything that touches `dist/cli.js` or runs `pnpm build`, since `tsup` cleans `dist/` at build start and concurrent workers will hit ENOENT/MODULE_NOT_FOUND mid-test (Evidence L57, L115).
3. Before declaring a dist-backed failure a product bug, rebuild and rerun — stale `dist/cli.js` will surface as missing generated prompts or implementation regressions that do not exist in source (Evidence L116, L165).
4. In `.github/workflows/ci.yml`, place `pnpm build` BEFORE `pnpm test` and `pnpm test:coverage` whenever those configs include integration files that exec `dist/cli.js`; only `pnpm test:e2e` self-builds (`pnpm build && vitest run --config ...`) (Evidence L187).
5. Keep `runCli`/e2e CLI helper timeouts comfortably above targeted-run latency so full-suite parallel pressure does not exceed the 30s budget; reproduce timeout-looking failures both targeted and under the full runner before treating them as product behavior failures (Evidence L53).
6. When refactoring cache-backed features that dist-backed tests exercise (remote extends, refresh), preserve existing on-disk cache paths for supported providers unless an explicit migration is added and verified — changing GitHub cache-key layout breaks refresh tests that look in the prior directory (Evidence L119).
7. Unit tests that call `runGenerate`/`runWatch` directly (same process) contribute to coverage; dist-backed integration tests that exec a subprocess do not — pick the harness intentionally when targeting coverage gaps (Evidence L109).
