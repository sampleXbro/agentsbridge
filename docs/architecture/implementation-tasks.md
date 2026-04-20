# Implementation Tasks — Architectural Hardening

**Audience:** Mid-tier coding models (or engineers) executing the work in `docs/architecture/review.md`.
**Sequencing:** Tasks are grouped into phases P0 → P2. Respect the "blocks" field; don't start a blocked task.
**Verification:** Every task ends in a concrete command sequence that must pass. No task is "done" before those commands are green on a clean checkout.
**Scope discipline:** Each task is one PR. Do not bundle across tasks. Do not refactor adjacent code opportunistically — open a follow-up task instead.

Global pre-flight (read before picking up any task):

1. Read `tasks/lessons.md` end-to-end. Cite applicable lessons in the PR description.
2. Read `docs/architecture/review.md` for the finding the task implements.
3. Read `docs/architecture/testing-strategy.md` before writing or modifying tests.
4. Canonical source of truth is `.agentsmesh/`. Never edit generated artifact trees.
5. All files stay ≤ 200 LOC. Split by responsibility before you exceed the budget.
6. Run `pnpm build && pnpm lint && pnpm typecheck && pnpm test` before marking any task complete. Dist-backed tests require `pnpm build` first.

---

## Phase P0 — eliminate scale blockers

These three tasks land first. They unblock §3.3/§3.4 (shape changes) in P1.

### P0-1 — Sweep hardcoded target-name branches out of `src/core`

**Implements:** Review §3.1.

**Goal:** No target-id string literal exists outside `src/targets/` and `src/targets/catalog/`.

**Inventory (exhaustive — start here):**
- `src/core/lint/commands.ts` — branches for `copilot`, `cursor`, `gemini-cli`, `continue`.
- `src/core/lint/mcp.ts` — branches for `cursor`, `codex-cli`, `junie`, `windsurf`.
- `src/core/lint/permissions.ts` — `if (target !== 'cursor') return []`.
- `src/core/reference/rewriter.ts:26,39,70` — `CODEX_CLI` constant, `.agents/skills/` hardwired map, `.github/instructions/` cache key.
- `src/core/generate/engine.ts:~101` — Gemini settings branch.
- Re-check with: `rg -n "'(codex-cli|copilot|cursor|gemini-cli|windsurf|junie|continue|kiro|antigravity|roo-code|claude-code|cline)'" src/core src/cli`.

**Change plan:**
1. Add optional per-feature hooks on the descriptor:
   - `descriptor.lint?: { rules?, commands?, mcp?, permissions?, hooks?, ignore?, settings? }` each a `(canonical, opts) => LintDiagnostic[]`.
   - Move the per-target branch bodies into the owning descriptor's `lint.<feature>` method. Shared helpers go in `src/core/lint/shared/`.
2. Introduce `descriptor.sharedArtifacts?: { readonly [path: string]: 'owner' | 'consumer' }` and make the rewriter select the owner dynamically from `config.targets ∩ owners`.
3. Delete `CODEX_CLI` constant and the copilot cache-key special case. Both resolve via the output-family model introduced in P1-3; **for this task**, keep temporary fallbacks that use `sharedArtifacts` instead of a literal target ID.
4. Delete the Gemini engine branch. Replace with a generic `if (descriptor.generators.settings) emit settings(...)` dispatch.
5. No behavior change for any target. The matrix tests must stay green without modification.

**Files expected to change:** ~6 core files + 11 target `index.ts` files (add lint hooks where applicable) + tests.

**Tests:**
- Add `tests/unit/core/lint-dispatch.test.ts` verifying lint calls each descriptor's lint hook.
- Update per-feature lint tests to exercise the new dispatcher.

**Verification:**
```
rg -n "'(codex-cli|copilot|cursor|gemini-cli|windsurf|junie|continue|kiro|antigravity|roo-code|claude-code|cline)'" src/core src/cli
# → zero hits
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

**Rollback:** Single-commit revert is safe; no format changes.

**Estimated diff size:** 300–600 LOC net.

**Blocks:** P1-3 (output families).

---

### P0-2 — Extract shared skill-import pipeline

**Implements:** Review §3.2.

**Goal:** Delete five duplicated `*-skills-helpers.ts` files in favor of one shared pipeline.

**Files to delete or reduce:**
- `src/targets/copilot/agents-skills-helpers.ts`
- `src/targets/cline/skills-helpers.ts`
- `src/targets/cursor/skills-helpers.ts`
- `src/targets/codex-cli/skills-helpers.ts`
- `src/targets/windsurf/workflows-skills-helpers.ts`

**Change plan:**
1. Create `src/targets/import/shared/skill-import-pipeline.ts` (≤ 200 LOC) exposing:
   - `readNativeSkill(dir, opts): Promise<CanonicalSkill>`
   - `stripReservedArtifactNames(entries, reserved): Entry[]`
   - `normalizeProjectedAgentSkill(content, kind): string`
   - Reserved-name constants live in `src/targets/import/shared/reserved.ts` (consolidated list from all five files).
2. For each former `*-skills-helpers.ts`, replace with a thin adapter: `src/targets/<target>/skills-adapter.ts`, ≤ 50 LOC, binds descriptor layout to the pipeline.
3. Keep behavior byte-equal. The matrix + roundtrip tests are the truth.

**Tests:**
- `tests/unit/targets/import/shared/skill-import-pipeline.test.ts` — table-driven over all five skill-flavor inputs (preseeded fixtures).
- Per-target skill unit tests continue to pass without edits.

**Verification:**
```
rg -l "skills-helpers" src/targets
# → only the import/shared path + adapters
pnpm build && pnpm test && pnpm test:e2e
```

**Lesson citations:** 89, 90.

**Estimated diff size:** -400 LOC, +200 LOC shared. Net reduction.

**Blocks:** none after P0-1.

---

### P0-3 — Split oversized files

**Implements:** Review §3.12.

**Goal:** No file in `src/` exceeds 200 LOC.

**Known offenders (as of review date):**
- `src/core/reference/import-map-builders.ts` (~421 LOC) → split to `src/core/reference/import-maps/<target-id>.ts`, one per target; add `src/core/reference/import-maps/index.ts` aggregator.
- `src/targets/gemini-cli/generator.ts` (~243 LOC) → split to `generator/{rules,commands,agents,skills,mcp,hooks,ignore,settings}.ts`.
- `src/targets/codex-cli/generator.ts` (~237 LOC) → same split.
- `src/targets/cursor/generator.ts` (~237 LOC) → same split.
- `src/targets/windsurf/generator.ts` (~229 LOC) → same split.
- `src/targets/cline/generator.ts` (~193 LOC) → on the edge; split if any follow-up adds ≥10 LOC.

**Change plan:** Mechanical. No behavior change. Preserve imports elsewhere via re-exports if needed.

**Tests:** Existing. Rerun full suite.

**Verification:**
```
find src -name '*.ts' -not -path '*/node_modules/*' | xargs wc -l | awk '$1 > 200 && $2 != "total" {print}' 
# → empty
pnpm build && pnpm test && pnpm test:e2e
```

**Estimated diff size:** High line count, near-zero behavior change.

**Blocks:** none.

---

## Phase P1 — shape changes

These change public-ish types on `TargetDescriptor`. Do them in one feature window with a single deprecation notice.

### P1-1 — Introduce `TargetCapabilityValue` with level + flavor

**Implements:** Review §3.3.

**Goal:** Unify `generateWorkflows`/`generateSettings`/`generatePermissions` into the canonical `TargetGenerators` via capability flavor.

**Change plan:**
1. Define:
   ```ts
   type SupportLevel = 'native' | 'embedded' | 'partial' | 'none';
   type FeatureFlavor = 'standard' | 'workflows' | 'settings-embedded' | 'projected-skills' | 'gh-actions-lite' | string;
   interface TargetCapabilityValue { level: SupportLevel; flavor?: FeatureFlavor }
   type TargetCapabilities = Record<CanonicalFeature, TargetCapabilityValue>;
   ```
2. For one minor, accept both the old `SupportLevel` literal shape and the new object shape on read. `getTargetCapabilities` normalizes. Write path emits the new shape only.
3. Delete `generateWorkflows`, `generateSettings`, `generatePermissions` from `TargetGenerators`. Migrate Cline/Windsurf/Gemini to `generateCommands`/`generateIgnore`/`generatePermissions` (canonical names). The flavor is an argument the generator reads:
   ```ts
   interface GenerateArgs<F extends CanonicalFeature> {
     canonical: CanonicalFiles;
     capability: TargetCapabilityValue; // includes flavor
     scope: Scope;
   }
   ```
4. Update the engine to pass `capability` into each generator.

**Matrix test impact:** `SUPPORT_MATRIX` and `SUPPORT_MATRIX_GLOBAL` gain a flavor column. Update rendering. Update the README generator (see P1-4).

**Tests:**
- Framework unit tests for normalization of old → new capability shape.
- Contract matrix: no change for targets where flavor is `standard`; Cline/Windsurf/Gemini assert correct flavor in generator args.

**Verification:**
```
rg -n "generateWorkflows|generateSettings|generatePermissions" src
# → zero hits
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

**Lesson citations:** 62 (target support changes ripple through lint + docs).

**Blocks:** P1-4 (matrix codegen reads flavor).

---

### P1-2 — Consolidate global-mode hooks into `globalSupport`

**Implements:** Review §3.4.

**Goal:** Adding global mode touches exactly one block on the descriptor; `tsc` rejects partial global support.

**Change plan:**
1. Define:
   ```ts
   interface GlobalTargetSupport {
     capabilities: TargetCapabilities;
     detectionPaths: readonly string[];
     layout: TargetLayout; // carries rewriteGeneratedPath, mirrorGlobalPath, renderPrimaryRootInstruction
     scopeExtras?: ScopeExtrasFn;
   }
   ```
2. Add `descriptor.globalSupport?: GlobalTargetSupport`. Deprecate the bare fields (`global`, `globalCapabilities`, `globalDetectionPaths`, `generateScopeExtras`) but continue reading them for one minor.
3. Migrate every target that has global mode today. Remove the bare fields in the same PR.
4. Add a type-level assertion in `src/targets/catalog/builtin-targets.ts` that rejects a target with any partial global-mode shape.

**Tests:**
- Framework unit: global-mode hook resolver returns values from `globalSupport` when present, else falls back to bare fields.
- Contract matrix: all global-supported targets keep the same generated path set.

**Verification:**
```
rg -n "globalCapabilities|globalDetectionPaths|generateScopeExtras" src/targets
# → zero hits after migration (only in catalog legacy compat and tests)
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

**Lesson citations:** 13, 113, 114, 118.

**Blocks:** none (independent of P1-1).

---

### P1-3 — Output-family registry

**Implements:** Review §3.6.

**Goal:** Remove the remaining target-id-aware paths in the reference rewriter. Replace `additionalRootDecorationPaths` with declared output families.

**Change plan:**
1. Define:
   ```ts
   interface TargetOutputFamily {
     readonly id: string;                            // 'primary' | 'compat' | ...
     readonly kind: 'primary' | 'mirror' | 'additional';
     readonly basePath: string;                      // e.g. '.github/instructions/'
     readonly filenameFor?: (canonicalPath: string) => string;
   }
   interface TargetLayout { outputs?: readonly TargetOutputFamily[]; ... }
   ```
2. Update rewriter/reference-map to build one rewrite map per `(target, family)` pair. The `.github/instructions/` cache-key special case disappears; copilot declares a `'compat'` family.
3. Cursor's `additionalRootDecorationPaths` becomes two `'additional'` families.
4. The shared-artifact logic (P0-1 step 2) rereads owner/consumer from the output-family registry, not a string path.

**Tests:**
- Framework unit: rewrite map is built per family; content rewriting runs for every emitted file (lesson 72).
- Matrix: assert Copilot's two families and Cursor's mirror.

**Verification:**
```
rg -n "additionalRootDecorationPaths" src
# → zero hits
pnpm build && pnpm test && pnpm test:e2e
```

**Lesson citations:** 7, 72, 75.

**Blocks:** none after P1-1.

---

### P1-4 — Matrix codegen and drift gate

**Implements:** Review §3.5.

**Goal:** README and website support matrices are generated from `SUPPORT_MATRIX` + flavor annotations. CI fails on drift.

**Change plan:**
1. New script `scripts/render-support-matrix.ts` writes:
   - A Markdown table for `README.md` between `<!-- agentsmesh:support-matrix:project -->` and `<!-- agentsmesh:support-matrix:global -->` markers.
   - An MDX fragment for `website/src/content/docs/reference/supported-tools.mdx`.
2. Add `pnpm matrix:generate` (runs the renderer) and `pnpm matrix:verify` (runs to a tempfile and diffs; non-zero on mismatch).
3. CI job `matrix-verify` runs `pnpm matrix:verify`.
4. Pre-commit hook (optional, in `.agentsmesh/hooks.yaml`) regenerates on canonical descriptor changes.

**Tests:**
- `tests/integration/matrix-codegen.integration.test.ts` — snapshot the rendered matrix for a fixture target catalog.
- `tests/integration/matrix-drift-guard.integration.test.ts` — run the verifier in a temp clone and assert it detects intentionally-introduced drift.

**Verification:**
```
pnpm matrix:generate && git diff --exit-code README.md website/src/content/docs/reference/supported-tools.mdx
# → exit 0
pnpm matrix:verify
```

**Lesson citations:** 62.

**Blocks:** none after P1-1 (so flavor column is present).

---

### P1-5 — Detection-path unified collector

**Implements:** Review §3.7.

**Goal:** Exactly one producer, one consumer per scope. Init, doctor, and tests call the collector.

**Change plan:**
- `src/targets/catalog/detection.ts` exports `collectDetectionPaths(scope): { target: string; path: string }[]`.
- Rewire `src/cli/commands/init.ts` detection logic and any integration tests to use it.
- Remove ad-hoc lists.

**Tests:** unit test for the collector across both scopes.

**Verification:**
```
rg -n "detectionPaths" src/cli
# → only via the collector
pnpm test
```

**Blocks:** none.

---

## Phase P2 — quality and scale payoff

### P2-1 — Parametrized target contract matrix

**Implements:** Review §3.10, Testing Strategy §3.

**Goal:** Each target supplies a fixture + contract file; one matrix test file exercises all.

**Change plan:**
1. New `tests/contract/` tree per Testing Strategy §3.1.
2. Port contract data from `tests/e2e/helpers/target-contracts.ts` into per-target `contracts/<id>.ts` files.
3. Write `tests/contract/target-contract.matrix.test.ts` with the eight assertions in Testing Strategy §3.2.
4. **Delete** per-target unit files covered by the matrix. Keep only files for target-unique behavior.
5. Update `vitest.config.ts` include list.
6. Update CI to run `pnpm test:contract` as a distinct stage.

**Tests:** The matrix itself is the test.

**Verification:**
```
pnpm test:contract
pnpm test
find tests/unit/targets -name '*.test.ts' | wc -l
# → substantially lower than before
```

**Lesson citations:** 122–126.

**Blocks:** all of P1 (matrix reads `capabilities.flavor` and `globalSupport`).

---

### P2-2 — Unified watch harness

**Implements:** Review §3.11, Testing Strategy §8.

**Change plan:**
1. Create `tests/harness/watch.ts` with the four guarantees from Testing Strategy §8.
2. Port `tests/unit/cli/commands/watch.test.ts` and `tests/integration/watch.integration.test.ts` to the harness.
3. Reject any watch test outside the harness via a lightweight ESLint rule.

**Verification:**
```
pnpm test && pnpm test:coverage   # run twice back-to-back; zero watch flakes
pnpm flake:check                  # new script, 20× unit+contract
```

**Lesson citations:** 18, 28, 29, 33, 34, 56, 60, 61, 111.

**Blocks:** none.

---

### P2-3 — Public library export

**Implements:** Review §3.8.

**Change plan:**
1. Add `./engine`, `./canonical`, `./targets` to `package.json` exports with `tsup` entry points.
2. Author `src/public/engine.ts`, `src/public/canonical.ts`, `src/public/targets.ts`. Re-export only the listed symbols from Review §3.8.
3. Smoke test: build and `npm pack`, then in a temp project `pnpm add <tarball>` and run a small script that imports each entry.

**Verification:** the packed-smoke test is the gate.

**Blocks:** none.

---

### P2-4 — Plugin contract regression test

**Implements:** Review §3.9.

**Change plan:**
- `tests/unit/targets/registry/plugin-target.test.ts` registers a mock descriptor via `registerTargetDescriptor`, runs generate + import, asserts the contract.
- No runtime behavior change.

**Blocks:** P2-3.

---

### P2-5 — Coverage closure

**Implements:** Testing Strategy §9.

**Change plan:**
1. Create `tasks/coverage-gaps.md` listing the exclusions in `vitest.config.ts` with justifications and bug IDs.
2. For each gap listed in `lessons.md` line 53 (remote fetcher offline, engine branches, merger, version, watch), write one framework unit test with the mock target.
3. Raise branch threshold to 87 in `vitest.config.ts` after gaps close.

**Verification:**
```
pnpm test:coverage
# branches ≥ 87 per-folder where applicable
```

**Blocks:** P2-2 (watch tests move first).

---

## Phase P3 — roadmap (no current owner)

- Canonical format snapshot test (Review §3.13).
- Property-based tests for reference rewriter (Testing Strategy §14 non-goal, reconsider).
- Live-tool smoke script for pre-release QA.
- Mutation testing once branch coverage sustains ≥ 90%.

---

## Task status ledger

Maintain the current state of each task here. Update when a task moves.

| Task | Status | Owner | PR |
| --- | --- | --- | --- |
| P0-1 Sweep hardcoded target names | done | — | — |
| P0-2 Shared skill-import pipeline | done | — | — |
| P0-3 File-size compliance | done | — | — |
| P1-1 Capability flavor | done | — | — |
| P1-2 `globalSupport` shape | done | — | — |
| P1-3 Output-family registry | done | — | — |
| P1-4 Matrix codegen + drift gate | done | — | — |
| P1-5 Detection-path collector | done | — | — |
| P2-1 Target contract matrix | done | — | — |
| P2-2 Watch harness | done | — | — |
| P2-3 Public library export | done | — | — |
| P2-4 Plugin regression test | done | — | — |
| P2-5 Coverage closure | partial | — | `tasks/coverage-gaps.md`; branch gate 84% until gap tests → 87% |

---

## Cross-task rules (apply to every task)

1. **One PR per task.** No bundling. Open a follow-up issue for anything adjacent.
2. **No silent format changes.** If a change alters a generated file's bytes (including whitespace), the PR must say so explicitly and include an updated golden if one exists for that file.
3. **Update `tasks/lessons.md`** whenever a test failure, CI failure, or reviewer correction occurs. One bullet: what failed, root cause, preventative rule.
4. **Document user-visible behavior changes** in a changeset (`pnpm changeset`).
5. **Never** weaken a test assertion to pass a PR. If an assertion is wrong, fix the assertion **and explain why** in the PR description.
6. **Never** add a new target-name string literal to `src/core/` or `src/cli/`. If a task seems to require it, stop and re-read §3.1 of the review.
7. **Size-check every touched file** with `wc -l`. Refuse to merge past 200.
