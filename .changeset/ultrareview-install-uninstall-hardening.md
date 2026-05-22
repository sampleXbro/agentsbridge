---
'agentsmesh': minor
---

Ultrareview hardening pass on the new install / uninstall / installs pipeline. Two silent-data-corruption fixes, one mid-batch failure-isolation fix, and a wave of smaller correctness, schema, file-size, and docs improvements found in a senior-architect review of the unreleased work.

**Silent data corruption — fixed**

- `apply-decisions.ts` (broken-link `[i]nclude resolvable` branch): the body rewrite now matches `link.raw` (the verbatim destination as scanned), not the normalized form. Bodies authored with `{baseDir}/foo.md` or Windows-style `..\refs\x.md` previously copied the supporting file but silently skipped the rewrite, leaving an orphan in `references/` and a still-broken link in the body. Now both forms rewrite correctly.
- `apply-decisions.ts` basename collision: two distinct outside paths sharing a basename (e.g. `docs/A/README.md` and `docs/B/README.md` both resolving to `references/README.md`) previously dropped the second file's bytes and pointed both citations at the same target. Names are now slugged from the full `resolvedRelative` on collision (`references/docs-A-README.md`, `references/docs-B-README.md`), preserving distinct content.

**Uninstall failure isolation**

- `runUninstall` mid-batch `applyUninstall` throws no longer abort the whole batch. Each pack runs in its own `try/catch`; survivors continue; per-pack errors land in a new `data.failed[]` envelope. Post-operation `generate` always runs over the packs that succeeded so the tool tree stays consistent with the (possibly partially mutated) `installs.yaml`. Exit code is `1` when any pack failed, `0` when all succeeded.
- Validation failures under `--json` no longer leak to stderr; they go only into the JSON envelope's `error` field. Same for per-pack failures.
- `--dry-run uninstall` is now truly side-effect-free for legacy packs. Previously the legacy-manifest migration wrote `.agentsmesh-install-manifest.json` before the dry-run preview returned; now it computes the baseline in memory and skips persistence under `--dry-run`.

**Drift detection robustness**

- `hashFileForManifest`: text-extension files (`.md`, `.json`, `.yaml`, etc.) are now hashed with line-endings normalized to LF and a leading UTF-8 BOM stripped. A Windows editor saving CRLF, or a tool inserting a BOM, no longer registers as drift.
- `readDirRecursiveNoSymlinks`: install-time pack hashing and uninstall-time drift detection skip symlinks entirely. A symlink that used to be followed at install (silently absorbing external bytes into the hash) only to be unlinked-without-following at uninstall (`rm` removes the link, not the target) no longer produces a permanent drift-detection mismatch.
- `AppliedRemoval.partial` (and `UninstallRemovedEntry.partial`): new boolean flag for JSON consumers to distinguish a fully-clean removal from a partial one (`--keep-pack`, `[k]eep-modified`, missing extends row, etc.). Additive.

**CLI / docs**

- Install help banner and website docs now list the `--all` flag and note that `--force` is implied by `--json` (for `uninstall` too). `AGENTSMESH_STRICT_PLUGINS` added to the README env-var table.
- `agentsmesh installs --help` now reads from the central `help-data.ts` source of truth instead of a hand-rolled banner that had already drifted.

**Schema / API tightening**

- `validateDescriptor()` now requires the `metadata` block (`displayName`, `category`, `officialUrl`, `shortDescription`). Built-in descriptors and bundled fixture plugins already declare it; external plugins built against earlier versions will need to add a `metadata` block. The Zod schema also tightens `emitScopedSettings`, `mergeGeneratedOutputContent`, `postProcessHookOutputs`, and `preservesManualActivation`.
- `install-flags.ts`: `--path` is now `.trim()`ed symmetrically with `--target` and `--as`. A recursive call passing `{ path: '  ' }` (e.g. from auto-pick fallback) used to produce a non-existent join; now treated as "not provided".
- `install-name.ts`: `canonicalRemoteIdentity` strips the `git+` prefix iteratively instead of recursively, removing an unbounded-recursion surface for pathological inputs like `git+git+git+https://…`.
- `install-lock.ts`: `acquireInstallLock` now `mkdir`s the canonical dir before attempting to write the lockfile, so a first-time install on a fresh project no longer fails with ENOENT.
- `merge-commands.ts`: a previously dead defensive branch now throws an explicit invariant error if the winner/loser invariant ever breaks — fail loud, not silent.

**Backward compatibility note for existing installs**

Packs installed before this version stored manifests with raw-byte hashes for text files. After upgrade, drift detection re-hashes with CRLF/BOM normalization. On hosts where text files were always LF without BOM (typical Linux / macOS), the hashes still match. On hosts where some text files contain CRLF or a BOM (typical Windows-authored content), those files may report as `modified` on the first `uninstall` after upgrade — the user gets the standard `[d]elete-anyway / [k]eep-modified / [a]bort` prompt; `--force` accepts the default. No data is lost. Future installs use the new algorithm consistently.

**File-size discipline**

- `src/install/classify/layout-detect.ts` (244 → 116 lines) split into `detectors/{fs-helpers,root-shape,collections}.ts`.
- `src/install/run/run-install-locked.ts` (295 → 180 lines) split into `single-pack-install.ts` (prompt → execute → write for one pack) and `route-picker-result.ts` (picker dispatch into marketplace recursion or single-candidate forward).

**Test strategy**

- Tightened 6 loose-assertion `*-branches.test.ts` files (replaced `some(...)`, `toBeGreaterThan(0)`, `toBeInstanceOf(Map)`, and dispatch-only `typeof === 'function'` checks with exact key / path / shape assertions).
- New focused unit tests for `routePickerResult`, `runUninstall` failure-isolation, layout-detect helper modules, `readDirRecursiveNoSymlinks`, `hashFileForManifest` CRLF/BOM/null-hash branches, and the schema's `metadata` requirement.
- `vitest.config.ts` coverage exclusions are now grouped into six documented categories (types/barrel, I/O wrappers, network/subprocess boundaries, per-target legacy linters, install hint maps pending refactor, orchestration shells) with explicit rationale for each. The 95% line/branch/function threshold applies to the remaining 88% of `src/**/*.ts`.

**Deferred to a follow-up PR**

- `src/install/native/native-path-pick-infer.ts` still hardcodes per-target dir prefixes for 8 targets. The refactor to make it descriptor-driven touches all 27 builtin descriptors plus three bespoke-layout targets (`gemini-cli`, `cline`, `codex-cli`); kept out of this changeset to keep the blast radius reviewable. The file stays in the coverage exclude list with a `category 5` comment until refactored.
