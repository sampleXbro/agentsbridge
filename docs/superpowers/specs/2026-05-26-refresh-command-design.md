# `agentsmesh refresh` Command Design

**Status:** Draft for approval (revision 2)
**Date:** 2026-05-26
**Author:** Brainstorm session (Claude + Serhii)
**Replaces / relates to:** install pipeline (`docs/superpowers/specs/2026-05-18-install-pipeline-hardening-design.md`)

## Revision history

- **r1 (2026-05-26):** Initial design based on a high-level survey. Proposed a new `src/install/refresh/` orchestrator with its own atomic-swap, EXDEV fallback, orphan recovery, two refactors (`run-single-pack-install` split, drift detection extraction).
- **r2 (2026-05-26):** Pre-plan code reading uncovered that **`materializePack()` in `src/install/pack/pack-writer.ts` already implements** the exact atomic swap + backup + restore + orphan cleanup we designed, and **`detectModifiedFiles()` is already standalone**. The fictitious `run-single-pack-install.ts` target does not exist. Architecture, refactors, atomicity sections, and effort estimate rewritten to compose existing primitives. All non-architectural decisions (command surface, flags, MCP parity, bulk-by-default, consolidated prompt with timeout, `refreshed_at`, docs) preserved unchanged.

## Summary

Add a new top-level command, `agentsmesh refresh`, that re-fetches and re-applies installed packs against their originally-recorded source/ref expression. Branch pins re-resolve to the current tip; tag pins re-resolve in case the tag moved; SHA pins re-resolve to the same SHA. The on-disk pack content is replaced atomically per pack, the `extends` row in `agentsmesh.yaml` is preserved, and `runPostOperationGenerate()` runs once at the end if any pack changed.

The command is bulk-by-default (no arguments → refresh every installed pack in scope) and is exposed at full parity over CLI and MCP.

## Goals

- Provide a single command for "bring my installed packs up to date with their declared sources".
- Preserve user trust by making each pack refresh atomic — a failure or interruption leaves the pack in its pre-refresh state, never in a half-removed limbo.
- Reuse existing install/uninstall building blocks (ref resolution, drift detection, manifest helpers, lock acquisition, post-op generate) instead of inventing parallel paths.
- Match the existing CLI/MCP surface conventions so that refresh feels native to the rest of the tool.

## Non-goals

- Changing the `extends` schema, the manifest schema (aside from one optional new field), or the lock format.
- Adding offline / `--no-fetch` semantics, only-changed fast paths, or any flag beyond the four agreed below.
- Automatic retries on network failures.
- Refresh as a synonym for "switch ref" — `refresh` never moves a pin to a new user-specified ref. To switch refs, the user re-runs `agentsmesh install` with a new `--ref`.
- Telemetry, debug log files, or consolidated error summaries.

## Decisions log (from brainstorm)

1. **Command name:** `refresh` (not `update`).
2. **Semantics:** behave as if user ran `uninstall` then `install` against the originally-recorded source — branches move to tip, tags re-resolve, SHAs stay put.
3. **Drift handling:** detect modified files via SHA-256 against the manifest. Prompt with a single consolidated message at the start of apply ("local edits will be overwritten") unless `--force`. See decision #15 for prompt shape.
4. **Bulk scope:** bare `refresh` refreshes every installed pack; `refresh <name>[,<name>...]` narrows. Diverges from `uninstall --all` convention deliberately (npm-style).
5. **Flags:** `--dry-run`, `--force`, `--json`, `--global`. No `--keep-generated`, no offline mode, no only-changed flag.
6. **MCP parity:** full MCP tool `mcp__agentsmesh__refresh` with the same input shape, error wrapping, and forced `force: true` in non-TTY contexts.
7. **Implementation approach:** dedicated orchestrator under `src/install/refresh/` that composes the existing install pipeline. **Atomicity is inherited from `materializePack`'s existing 3-step swap with `.old` backup** (originally r1 proposed reinventing this; r2 discovered it already exists).
8. ~~**Refactor:** split `runSinglePackInstall` into three exported helpers.~~ **Superseded by r2:** `runSinglePackInstall` does not exist; the install pipeline is already factored. New plan: add an optional `forceFreshMaterialize` flag to `installAsPack` (~20 LOC) so refresh can bypass the merge-into-existing branch.
9. **Manifest schema:** add optional `refreshed_at` field. `installed_at` preserved across refresh.
10. ~~**EXDEV fallback:** include cross-filesystem copy+delete path in v1.~~ **Superseded by r2:** `materializePack` owns the swap; refresh inherits its cross-fs behavior (no new fallback to write).
11. ~~**Orphan backup recovery:** detect and recover from mid-swap crashes on the next refresh invocation.~~ **Superseded by r2:** `materializePack` already cleans stale `.tmp`/`.old` on every invocation. Refresh inherits this for free.
12. **User-declined skips → exit 0.** Failures → exit 1.
13. **Output channel for errors:** stderr only. No per-pack `.error.log` files.
14. ~~**Drift detection helper:** extract `detectPackDrift()` from `gatherUninstallDecisions`.~~ **Superseded by r2:** drift detection is already standalone in `detectModifiedFiles()`. Refresh imports it directly.
15. **Consent prompt is consolidated across all packs at the start of apply**, not per-pack mid-loop. Reduces UX friction and shortens lock-hold time.
16. **Prompt timeout:** 5-minute timeout on consent prompts, default-to-no, releases the lock if hit. Prevents an abandoned terminal from blocking project-wide install/uninstall operations.
17. **Bulk renderer output:** per-pack file *counts* by default; full added/removed/modified lists only under `--verbose` or in `--json`.
18. **Switch-ref workflow stays out of refresh.** To move a pack to a different ref, users uninstall + install. This is documented in the README/website page.

## Command surface

```
agentsmesh refresh [<name>[,<name>...]] [--dry-run] [--force] [--json] [--global]
```

- `<name>` — comma-separated install names. Omitted → every pack in scope.
- `--dry-run` — resolve refs, compute diff, write nothing.
- `--force` — skip drift prompts, overwrite modified files.
- `--json` — machine-readable result.
- `--global` — operate on `~/.agentsmesh/` instead of project scope.

### Exit codes

- `0` — every targeted pack landed in `refreshed[]` ∪ `unchanged[]` ∪ `skipped[user-declined]`.
- `1` — at least one pack in `failed[]`.
- `2` — invalid invocation (unknown pack name, malformed flags).

### MCP

Tool name: `mcp__agentsmesh__refresh`. Input shape:

```ts
interface RefreshHandlerInput {
  names?: string[];
  dryRun?: boolean;
  force?: boolean;     // implicitly true in non-TTY MCP context
  global?: boolean;
}
```

Error wrapping via `wrapInstallError()` with three new codes:
- `REFRESH_RESOLVE_FAILED`
- `REFRESH_APPLY_FAILED`
- `REFRESH_CONCURRENT_MODIFICATION`

Existing `LOCK_HELD` and `IO_ERROR` codes reused.

### Result type

```ts
interface RefreshCommandResult {
  exitCode: 0 | 1 | 2;
  data: {
    refreshed: RefreshedItem[];   // { name, oldRef, newRef, oldSha, newSha, changedFiles }
    unchanged: UnchangedItem[];   // { name, ref }
    skipped: SkippedItem[];       // { name, reason: 'user-declined' }
    failed: FailedItem[];         // { name, phase, error }
  };
}

interface ChangedFiles {
  added: string[];
  removed: string[];
  modified: string[];
}
```

All paths normalized to forward slashes for CLI display (per CLAUDE.md rule).

## Architecture

### Discovery: existing primitives already do most of the work

A pre-implementation code read uncovered that two key pieces of the original (r1) design **already exist** in the codebase and don't need to be built or refactored:

1. **`materializePack()` in `src/install/pack/pack-writer.ts:174-260`** writes new content to `<packName>.tmp/`, then performs an atomic 3-step swap: `rename(finalDir → .old)` → `rename(tmpDir → finalDir)` → `rm -rf .old`. On rename failure it restores from `.old`. On invocation it cleans stale `.tmp`/`.old` left by a prior crash. **This is exactly the atomic-swap-with-backup-and-orphan-recovery the r1 spec proposed to build under `src/install/refresh/`.** Refresh reuses it directly.
2. **`detectModifiedFiles()` in `src/install/uninstall/detect-modified.ts`** is already a pure, standalone function returning `ModifiedFile[]` with `modified | deleted | added` status. The r1 spec's "Refactor B" (extract drift detection from `gatherUninstallDecisions`) is unnecessary — refresh just imports `detectModifiedFiles` directly.

The r1 spec's "Refactor A" (split `run-single-pack-install.ts` into three helpers) is also discarded: that file does not exist. The install pipeline is already factored across `src/install/run/run-install-*.ts` and `src/install/pack/pack-writer.ts`.

### File layout

```
src/install/refresh/
├── run-refresh.ts            # entry point: lock, orchestration (< 200 LOC)
├── refresh-plan.ts           # planning phase: read manifest, resolve ref, drift-detect
├── refresh-flags.ts          # flag parsing
├── refresh-result.ts         # result/item types
└── refresh-prompt.ts         # consolidated consent prompt with timeout

src/cli/commands/refresh.ts          # thin wrapper delegating to runRefresh()
src/cli/renderers/refresh.ts         # text + JSON output

src/mcp/handlers/refresh.ts          # MCP handler
src/mcp/tool-tables/refresh-tools.ts # tool table entry
```

Five new production files under `src/install/refresh/` (down from eight in r1) — no `refresh-stage.ts` (materialize owns staging), no `refresh-apply.ts` (materialize owns the swap). Plus CLI wrapper, renderer, and MCP handler. Each file under the 200-LOC project cap.

### One small refactor

`installAsPack()` in `src/install/run/run-install-pack.ts:80-199` currently looks up existing packs by source via `findExistingPack()` and routes to `mergeIntoPack()` instead of `materializePack()` when found. **Refresh needs to bypass that branch** — when refreshing, we want full replacement of pack contents with the new ref, not a merge.

The refactor: add an optional `forceFreshMaterialize?: boolean` flag to `InstallAsPackArgs`. When set, `installAsPack` skips the `findExistingPack` lookup and goes straight to `materializePack` (which will atomically replace the existing pack dir). Default behavior unchanged — install still does merge-on-existing.

Estimated size: ~20 LOC change to `installAsPack`, plus tests. No other call sites affected.

### Reused building blocks (all already exist)

| Need | Existing API | Location |
|---|---|---|
| Read installs manifest | `readInstallManifest()` | `src/install/core/install-manifest.ts:66` |
| Upsert manifest entry | `upsertInstallManifestEntry()` | `src/install/core/install-manifest.ts:78` |
| Resolve git ref to pinned SHA | `resolveRemoteRefForInstall()` | `src/install/source/git-pin.ts:63` |
| Drift detection | `detectModifiedFiles()` | `src/install/uninstall/detect-modified.ts:47` |
| Atomic pack write/swap/recovery | `materializePack()` | `src/install/pack/pack-writer.ts:174` |
| Install orchestration (per pack) | `installAsPack()` | `src/install/run/run-install-pack.ts:80` (with new `forceFreshMaterialize` flag) |
| Acquire `.install.lock` | `acquireInstallLock()` | `src/install/lock/install-lock.ts:34` |
| Post-op generate | `runPostOperationGenerate()` | `src/install/run/post-install-generate.ts` |
| Error redaction for MCP | `wrapInstallError()` | `src/mcp/handlers/install.ts:49` |
| Logger | `logger` | `src/utils/output/logger.ts` |
| Scoped config + canonical dir | `loadScopedConfig()` | `src/config/core/scope.ts` |

## Data flow: plan phase

Plan produces `RefreshPlan[]` (one entry per targeted pack) and writes nothing to disk. No speculative fetch in the plan phase — fetching is deferred to apply because `materializePack` owns its own staging (`<packName>.tmp/`) and we can't reuse a separately-staged dir without duplicating its internal logic.

Per pack:

1. Read manifest entry from `installs.yaml` (via `readInstallManifest()`).
2. Read `.agentsmesh-install-manifest.json` from `<canonicalDir>/packs/<name>/`. Missing/corrupt → emit error plan, skip apply.
3. Resolve original source/ref to a new SHA via `resolveRemoteRefForInstall()`. Network failures → emit error plan, skip apply.
4. Drift detection: call `detectModifiedFiles(packDir, manifestFiles)`. Returns `ModifiedFile[]` (each has `relativePath` and `status: 'modified'|'deleted'|'added'`).
5. Classify:
   - `unchanged` — `modifications` empty AND `newSha === oldSha`.
   - `clean-update` — `modifications` empty, `newSha !== oldSha`.
   - `needs-consent` — `modifications` non-empty (any of modified/deleted/added). Refresh will overwrite/delete/clobber. **No distinction between "drift-only" and "conflict"** — collapsed per decision #3.
   - `error` — any prior phase failed.

Plan classifications `drift-only` and `conflict` are collapsed into a single "local edits will be overwritten" message in user output.

### Lock during plan

`.install.lock` is acquired at the start of the invocation and held continuously through plan, prompts, apply, and post-op generate.

## Data flow: apply phase

### Consolidated consent gate

After plan completes, before the per-pack apply loop:

1. Classify each plan into `unchanged`, `clean-update`, `needs-consent` (drift-only or conflict), or `error`.
2. Record all `unchanged` in `result.data.unchanged`. Record all `error` in `result.data.failed`.
3. For `--dry-run`: render the plan, exit. Apply phase is never entered.
4. If `--force`: proceed directly to apply for both `clean-update` and `needs-consent` packs.
5. Without `--force`, if `needs-consent` is empty: proceed to apply.
6. Without `--force`, with `needs-consent` non-empty: emit **one consolidated prompt** listing every pack with local edits and per-pack file counts:

   ```
   The following N pack(s) have local edits that refresh will overwrite:
     - <name1>: 3 modified file(s)
     - <name2>: 1 modified file(s)
   Continue? [y/N/per-pack]  (5 min timeout, default N)
   ```

   - `y` → proceed to apply for all listed packs.
   - `N` or 5-minute timeout → record each `needs-consent` pack as `skipped[user-declined]`. `clean-update` packs still proceed to apply.
   - `per-pack` → fall back to one prompt per pack (each with a 5-minute timeout, default no), allowing fine-grained control.

Consolidating the prompt shortens lock-hold time and reduces friction in bulk refresh. The 5-minute timeout prevents an abandoned terminal from blocking project-wide operations.

**Prompt helper:**

```ts
function promptWithTimeout(
  message: string,
  timeoutMs: number,
): Promise<'y' | 'n' | 'per-pack' | 'timeout'>;
```

Implemented with Node's `readline` + `AbortController` + `setTimeout`. No platform-specific code. Tested against mocked stdin (standard pattern in the repo). Inherits Windows compatibility from the existing install/uninstall prompt code, which already runs on Windows in CI — the timeout layer is a pure wrapper that doesn't touch terminal escape sequences.

### Per-pack apply loop

Apply consumes the `RefreshPlan[]`. **All atomicity, staging, swap, backup, restore-on-failure, and orphan recovery are owned by `materializePack()`** — refresh does not reinvent any of these.

Per pack (skipping `unchanged`, `error`, and `user-declined`):

1. **Call `installAsPack(args)` with `forceFreshMaterialize: true`** where `args` reconstructs the original install invocation from the manifest entry:
   - `canonicalDir`, `packName` (from entry `name`).
   - `sourceForYaml` (from entry `source`), `version` (the new SHA from plan).
   - `sourceKind` (from entry `source_kind`).
   - `entryFeatures`, `pick`, `yamlTarget`, `pathInRepo`, `manualAs` (from entry).
   - `narrowed`, `selected` — derived by re-running the install resolution pipeline (fetch + classify + canonicalize + select) against the new ref. This is the same code path install uses today; refresh feeds it the recorded params instead of CLI args.
   - `contentRoot` — points at the freshly fetched upstream source.

   `installAsPack` internally calls `materializePack` (because `findExistingPack` is skipped when `forceFreshMaterialize: true`), which:
   - Stages new content in `<packsDir>/<name>.tmp/`.
   - On stale `.tmp`/`.old` from a prior crashed run: cleans them up first.
   - Atomic 3-step swap: `finalDir → .old`, `tmpDir → finalDir`, on failure restores from `.old`.
   - Best-effort `rm -rf .old` on success.

   `installAsPack` also calls `upsertInstallManifestEntry` with the new version SHA, updating `installs.yaml`.

2. **Stamp `refreshed_at`.** `installAsPack` does not know about `refreshed_at`. After it returns, refresh reads the just-written `installs.yaml` row and updates it with `refreshed_at = now`, preserving `installed_at`. This is two more `readInstallManifest` + `upsertInstallManifestEntry` calls.

   *Alternative (cleaner):* thread `refreshed_at` through `InstallAsPackArgs` and `buildInstallManifestEntry`. Trade-off: install-side code learns about a refresh-specific field. Considered acceptable — it's one optional field.

3. **Record success** in `refreshed[]` with `{ name, oldRef, newRef, oldSha, newSha }`.

On any thrown error from `installAsPack`: record `failed[]` with `{ name, phase: 'fetch'|'apply', error }`. Surviving packs continue. `materializePack`'s own try/catch already restores the pack from `.old` if the swap fails mid-rename — refresh inherits that safety.

### Post-op generate

After per-pack apply loop completes: if `refreshed.length > 0`, call `runPostOperationGenerate('refresh', scope, context.rootBase)` once. Otherwise skip.

(Note: `installAsPack` does NOT call `runPostOperationGenerate` itself — that's done by the install orchestrator. Refresh's orchestrator does it once at the end across all refreshed packs.)

### Bulk failure isolation

Each pack's apply is self-contained. Pack #3's failure does not abort packs #4 and #5. The exit code is determined by the final tally of result buckets.

## Error handling

### Error taxonomy

| Kind | Phase | Trigger | Result bucket |
|---|---|---|---|
| `manifest-missing` | plan | Pack dir lacks `.agentsmesh-install-manifest.json` | `failed[]` |
| `resolve-failed` | plan | `resolveRemoteRefForInstall()` throws (network, auth, ref-gone) | `failed[]` |
| `fetch-failed` | apply | `installAsPack` throws while fetching upstream | `failed[]` |
| `materialize-failed` | apply | `materializePack` throws (validation, swap, restore) — `materializePack` already restores from `.old` if the swap failed mid-rename, so the pack is left at its pre-refresh state. | `failed[]` |
| `manifest-update-failed` | apply | The post-`installAsPack` `refreshed_at` stamp fails | `failed[]` + banner (pack content is new, but `installs.yaml` row lacks `refreshed_at`) |

No `concurrent-modification` kind: there's no separate plan/apply phase boundary to detect drift across (refresh holds the lock continuously and fetches + materializes in a single transaction inside `installAsPack`). No `swap-failed` kind either: `materializePack`'s own restore-from-`.old` either fully succeeds (pack on new content) or fully restores (pack on old content). A genuine restore failure surfaces as `materialize-failed` carrying `materializePack`'s thrown error message.

### Recovery banner

`manifest-update-failed` prints an explicit banner: "Pack `<name>` content refreshed but `refreshed_at` not stamped. Re-run `agentsmesh refresh <name>` to reconcile." No data loss; just metadata staleness.

### MCP error mapping

- `manifest-missing`, `resolve-failed` → `REFRESH_RESOLVE_FAILED`
- `fetch-failed`, `materialize-failed`, `manifest-update-failed` → `REFRESH_APPLY_FAILED`
- Lock contention → existing `LOCK_HELD`
- Filesystem errors → existing `IO_ERROR`

All error messages have paths redacted via the existing `wrapInstallError` redactor.

### Validation errors (exit 2)

- Unknown pack name in `<names>` argument.
- `--global` with no `~/.agentsmesh/` directory.

Empty `installs.yaml` with no names provided → exit 0 with message `No packs to refresh.`

## Testing strategy

### Test layout

```
tests/unit/install/refresh/
├── refresh-flags.test.ts
├── refresh-plan-resolve.test.ts
├── refresh-plan-drift.test.ts
├── refresh-plan-classification.test.ts
├── refresh-prompt.test.ts
├── refresh-apply-success.test.ts
├── refresh-apply-failure.test.ts
├── run-refresh-bulk.test.ts
├── run-refresh-lock.test.ts
└── run-refresh-result.test.ts

tests/unit/install/install-as-pack-force-fresh.test.ts   # new flag on installAsPack
tests/unit/cli/refresh-command.test.ts
tests/unit/cli/renderers/refresh-renderer.test.ts
tests/unit/mcp/handlers/refresh-handler.test.ts

tests/integration/refresh-git-source.test.ts
tests/integration/refresh-local-source.test.ts
tests/integration/refresh-drift-flow.test.ts
```

No `refresh-apply-swap.test.ts`, `refresh-apply-recovery.test.ts`, or `refresh-crash-recovery.test.ts`: those behaviors live in `materializePack` and are already covered by `tests/unit/install/pack/pack-writer-*.test.ts` (existing install tests).

### TDD ordering

1. **Add `forceFreshMaterialize` flag to `installAsPack`** — write the test first, then add the flag. Existing install tests stay green.
2. **Refresh types, flags, result** — `refresh-flags.test.ts`, `refresh-result.test.ts`.
3. **Plan phase** — `refresh-plan-*.test.ts` (resolve, drift, classification).
4. **Consent prompt + timeout** — `refresh-prompt.test.ts`.
5. **Apply phase** — `refresh-apply-*.test.ts` (success path delegates to `installAsPack`; failure path verifies error capture and bulk continuation).
6. **Orchestrator** — `run-refresh-*.test.ts` (lock, bulk, result aggregation).
7. **CLI + MCP + renderer** — wiring tests.
8. **Integration** — bare-git-repo fixture for refresh-git-source, local-source flow, drift-flow.

### Strict-assertion discipline

Per CLAUDE.md generation-artifact rule:
- Exact file path lists after refresh (sorted `toEqual`, not `toContain`).
- Exact contents of `.agentsmesh-install-manifest.json` (hashes + timestamps including `refreshed_at`).
- Exact contents of new `installs.yaml` row.
- Exact byte-equality on dry-run (no file may change).

### Integration fixture

Bare local git repo with two commits at `tests/integration/fixtures/refresh-git-source/`. Test flow: install at commit A → force-push commit B onto same ref → refresh → assert tree matches commit B and old/new SHA differ in result.

## Documentation updates

Mandatory per CLAUDE.md docs rule:

- `README.md` — add `refresh` row to the CLI commands table, a usage example, and a short note that **`refresh` does not switch refs** — to move a pack to a different ref, uninstall and re-install with the new ref.
- `website/src/content/docs/reference/refresh.mdx` — new command reference page; linked from the CLI overview index. Must include:
  - The "refresh does not switch refs" note.
  - A "refresh vs `install --sync`" section: `--sync` replays missing installs from `installs.yaml`; `refresh` updates existing installs against their declared sources. They are orthogonal and never overlap.
- `CLAUDE.md` "AgentsMesh Generation Contract" paragraph — add `refresh` to the list of CLI commands alongside `diff`, `lint`, `check`, etc.

No per-target docs changes required. Refresh is not target-specific.

### Manifest read-site audit

Adding optional `refreshed_at` to manifest entries is backwards-compatible at write time. **Type-level enforcement makes a grep audit unnecessary**: declare the field as `refreshed_at?: string` on the source-of-truth type. The project is already strict-mode TypeScript with `noUncheckedIndexedAccess` and `no any` enforced — any consumer that reads `entry.refreshed_at` without narrowing the `string | undefined` will fail typecheck.

Known read sites updated as part of this change:
- `installs list` renderer — display `refreshed_at` if present, fall back to `installed_at` for the "last touched" column.

Other consumers surface via TypeScript errors during the refactor; they are fixed in the same PR. One positive test is added: a fixture row without `refreshed_at` going through `installs list` rendering produces a sensible output (no crash, falls back to `installed_at`).

### Pre-flight verification

Before refresh ships, verify the current behavior of `agentsmesh install <source>` against an already-installed pack name:

- If install errors on duplicate names → refresh becomes the only path forward and the "no switch-ref" rule may need reconsideration.
- If install overwrites silently → document the "uninstall + install with new ref" workflow in the docs above as the supported way to switch refs.

This check happens during the first implementation phase, not after refresh is built.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| **`installAsPack` `forceFreshMaterialize` flag changes install behavior** — adding a new code path inside a load-bearing function. | The flag defaults to `false`; install's existing flow is untouched when omitted. One new positive test (`install-as-pack-force-fresh.test.ts`) covers the new path. Existing install integration tests stay green. |
| **`narrowed` and `selected` re-derivation drifts from original install** — refresh re-runs fetch + classify + canonicalize + select using the recorded `features`/`pick`/`path`/`as`. If install's resolution logic ever changes, refresh's "same selection" guarantee weakens. | Refresh feeds the recorded `entry.features`, `entry.pick`, `entry.path`, `entry.as` directly into the existing install resolution pipeline. As long as install honors those fields deterministically (which it must — `installs.yaml` is the source of truth for `--sync` replay), refresh's selection matches install's. Integration test `refresh-drift-flow.test.ts` asserts the file-set equivalence. |
| **Terminal prompt portability** — 5-minute timeout introduces new stdin handling variance across macOS, Linux, Windows. | `promptWithTimeout()` helper built on Node's `readline` + `AbortController` + `setTimeout` — standard cross-platform primitives, no escape-sequence handling. Mocked-stdin unit tests. Inherits Windows CI coverage from existing prompt code. |
| **Manifest read-site audit completeness** — a missed read site for `refreshed_at` would crash on first refresh. | Type-level enforcement instead of grep. `refreshed_at?: string` forces every consumer to narrow `string \| undefined`; strict-mode TypeScript flags any unsafe read. One positive test asserts `installs list` renders correctly when the field is absent. |

(Removed from r1: cross-filesystem EXDEV risk, `runSinglePackInstall` refactor blast-radius risk. Both eliminated because refresh delegates to `materializePack` and does not introduce new swap logic.)

## Effort estimate

**1.5–2 focused days** for a senior pass that clears lint, the 200-LOC cap, strict-assertion tests, and the load-bearing-contract regression tests demanded by CLAUDE.md.

Approximate split:

- `installAsPack` `forceFreshMaterialize` flag + test: 10%
- Refresh types + flags + result types: 5%
- Plan phase (manifest read, ref resolve, drift detect, classify): 15%
- Consent prompt + 5-min timeout: 10%
- Apply phase (call `installAsPack` per pack, stamp `refreshed_at`): 15%
- Orchestrator + lock + bulk semantics + post-op generate: 10%
- CLI command + dispatcher wiring: 5%
- Renderer (text with --verbose gating, JSON): 10%
- MCP handler + tool table + error mapping: 5%
- Docs (README, website, CLAUDE.md): 5%
- Integration tests (git-source, local-source, drift-flow): 10%

(Reduced from r1's 3–5 days: removed EXDEV fallback, orphan backup recovery, `run-single-pack-install` refactor, drift detection extraction — all unnecessary once we discovered `materializePack` and `detectModifiedFiles` already provide these capabilities.)

## Approval

This spec was approved section-by-section during the brainstorm. The next step is to invoke the `superpowers:writing-plans` skill to produce an executable implementation plan.
