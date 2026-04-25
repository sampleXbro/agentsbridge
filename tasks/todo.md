# Finish & Test the Programmatic API

## Real gaps to close

After writing the website reference page I confirmed three concrete gaps that
prevent the Programmatic API from being usable end-to-end without internal-cast
hacks, plus a shallow test suite.

### 1. `loadConfig` not in public API

`loadConfigFromDir` lives in `src/config/core/loader.ts` but is never re-exported
from `src/public/`. Users who want to drive `generate()` programmatically can't
load `agentsmesh.yaml` cleanly — they either reach into `agentsmesh/dist/...`
(unsupported) or construct a config by hand.

**Fix:** export `loadConfig(projectRoot)` from `agentsmesh` and
`agentsmesh/engine`. Returns `{ config: ValidatedConfig, configDir: string }`.

### 2. `ValidatedConfig` type not exported

`GenerateContext.config: ValidatedConfig` is required, but `ValidatedConfig`
isn't on the public surface. The `consumer-smoke` test casts through `unknown`
to compile.

**Fix:** export `type ValidatedConfig` from `agentsmesh` and `agentsmesh/engine`.

### 3. Existing public-API test coverage is shallow

`tests/integration/public-export-smoke.integration.test.ts` only checks
`typeof === 'function'` and uses `length > 0` — violates the project rule for
strict assertions and proves no runtime behavior. Nothing covers:

- Real end-to-end `generate()` on a fixture project, asserting exact output set
- Real end-to-end `importFrom()` reading native config back into canonical form
- `registerTargetDescriptor` + `generate()` proving a plugin descriptor lands in results
- Each error class being thrown by a real call path with the right `code` field
- `loadConfig` shape

**Fix:** new comprehensive `tests/integration/programmatic-api.integration.test.ts`
that exercises every public symbol against real disk state with strict
assertions. Tighten the existing smoke test or merge into the new file.

## Out of scope (intentional)

- **`lint`, `diff`, `check`, `watch` programmatic API** — original v0.6
  Programmatic API ship targeted `generate` / `importFrom` / `loadCanonical` /
  `registerTargetDescriptor` / errors / types. Adding `lint`/`diff`/`check`
  to the public surface is a separate scope and a separate roadmap line item
  (still pending). Today's task is to make the *shipped* surface complete and
  tested.
- **`runGenerate(projectRoot)` convenience wrapper** — the building blocks
  compose to 3 lines. A wrapper would be a second API to maintain with no
  meaningful win. If real consumer feedback later asks for it, add then.
- **Semver freeze** — planned for v1.0, separate roadmap item.

## Implementation order

1. **Code:** add `loadConfig` runtime export and `ValidatedConfig` type export
   to `src/public/engine.ts` and re-export from `src/public/index.ts`.
2. **Code:** verify `consumer-smoke` no longer needs the `unknown` cast and
   tighten it to use `loadConfig` + `loadCanonical`.
3. **Tests:** write `tests/integration/programmatic-api.integration.test.ts`
   with strict assertions covering every public symbol + every error class.
4. **Tests:** delete or shrink `public-export-smoke.integration.test.ts`
   (replaced by #3, no longer adds value).
5. **Docs (website):** update
   `website/src/content/docs/reference/programmatic-api.mdx` to:
   - Add `loadConfig` and `ValidatedConfig` to the runtime/types tables
   - Replace the "config loader not exported" caveat with the working pattern
   - Show the canonical 3-line load → load → generate snippet
6. **Docs (README):** rewrite the broken `generate({ projectRoot, scope })`
   example to compile against the real `GenerateContext`.
7. **Docs (CHANGELOG):** add bullets under v0.6 Added and Changed for the new
   exports + tightened tests.
8. **Verify:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, then `pnpm build`
   and `pnpm consumer-smoke` to confirm the typed contract still holds.

## Lessons-driven safeguards

- Per lesson #80: rebuild dist before any dist-backed integration test.
- Per lesson #46: if I touch typed test files, run `tsc --noEmit` against them
  individually since the repo `tsconfig.json` excludes `**/*.test.ts`.
- Per lesson #15: rerun `pnpm lint` immediately after targeted tests.
- Per lesson #18: `tests/consumer-smoke/src/smoke.ts` is a typed test file
  outside the main suite — `pnpm consumer-smoke` is the gate that catches
  TS7016 regressions; run it explicitly after editing public exports.
