---
'agentsmesh': minor
---

Skill-pack-aware install pipeline, new `uninstall` and `installs` commands, descriptor-driven target dispatch refactors, and a senior-architect hardening pass. Roll-up of every change on `develop` since `v0.18.1`.

## New commands

### `agentsmesh install <url>` (extended)

Now auto-detects three source shapes via a multi-signal classifier (`src/install/classify/`) and dispatches accordingly:

- **`anthropic-skill-pack`** — imports root `skills/`, `agents/`, `references/`, merged per-target `.claude/commands/` + `.gemini/commands/`, and multi-tool rule files as one bulk set. A single command imports the full pack (e.g. all 23 skills + 3 agents + 7 commands of `addyosmani/agent-skills`); pre-change behaviour required 7+ invocations with `--as`.
- **`canonical-agentsmesh`** — unchanged.
- **`tool-native`** — unchanged. Five backcompat fixtures (`tests/integration/install-backcompat.integration.test.ts`) pin the discriminator threshold so legacy repos take their original path.
- **`unknown`** — unchanged canonical-slice fallback.

The discriminator threshold (sum of matched signal weights ≥ 1.4 with the primary `skills/<kebab>/SKILL.md` signal present) makes false positives essentially impossible on tool-native or canonical repos. `--target` and `--as` keep their explicit-override semantics and skip the classifier.

When classified as a skill pack and a TTY is attached, two interactive prompts surface:

- **Bulk select (three tiers)** — `[a]ll / [n]one / [s]elect per type` summary banner → per-type `[y/n/c]` → per-entity `[y/N/a=accept-all-remaining/q=skip-all-remaining]`. `--force`, `--json`, and non-TTY contexts accept everything.
- **Broken-link (three options)** — for body links that point outside the imported subtree, classify each as in-tree-included / resolvable-outside / unresolvable and cluster per entity. `[i]nclude resolvable as supporting files / [l]eave with warnings / [a]bort install`. `--force` defaults to `[l]eave-with-warnings`.

New flags:

- `--all` — install every sub-pack from a `.claude-plugin/marketplace.json` source.

Other install improvements:

- **Source-layout detection covers community-repo shapes**: root-level `SKILL.md` (`blader/humanizer`), root `.cursorrules` / `.windsurfrules` (`PatrickJS/awesome-cursorrules` style), nested marketplace plugin trees (`.claude-plugin/marketplace.json`), and arbitrary 2+ sub-pack directory layouts. The picker is descriptor-driven via `selectInstallCandidates`.
- **Concurrent-install lock** — `.agentsmesh/.install.lock` is acquired at the top of any `install` or `uninstall` run (and held across `--sync` replay). Concurrent invocations on the same project fail fast with `LockAcquisitionError` rather than racing on filesystem writes.
- **Pack writes are atomic** via staging-dir + rename. Each install now writes `.agentsmesh-install-manifest.json` next to the pack with the install-time `name`, `source`, `installed_at`, classifier verdict (`source_type`), and per-file `sha256:` map.
- **Pack-name preservation across URL variants** — `findExistingInstallName` (`src/install/core/install-name.ts`) keys reuse on canonical `github:<org>/<repo>` plus identity scope (`target + as + features`), so `https://`, `git@`, and `github:` spellings of the same source dedupe into one pack. The `git+` prefix is now stripped iteratively (no recursion, safe under malicious manifest input).
- **Lenient frontmatter parsing for all third-party imports** — `readSkillFrontmatterName` and `inferMdcTarget` skip files with invalid YAML and continue, rather than aborting the whole install on one bad scalar.
- **Flat-collection basename collisions** — when two `--as <kind>` flat-collection files share a basename, names are namespaced rather than dropped silently.
- **`--path`, `--target`, `--as` flags** — all trimmed symmetrically; empty/whitespace-only values now correctly normalise to "not provided" inside recursive auto-pick calls.

### `agentsmesh uninstall <name>[,<name>...]` (NEW)

Removes one or more installed packs:

- `rm -rf .agentsmesh/packs/<name>/`.
- Drops the row from `installs.yaml`.
- Drops the matching `extends:` row from `agentsmesh.yaml` when present (`install --extends` is now uninstallable).
- Runs `generate` so `cleanupStaleGeneratedOutputs` evicts orphaned target files.

Flags: `--all`, `--keep-pack` (leave pack on disk; only drop yaml entries), `--keep-generated` (skip the final generate; warn about stale targets), `--global`, `--dry-run`, `--force`, `--json`. The `--keep-pack` flag also doubles as the apply-layer equivalent of the interactive `[k]eep-modified` action. `--force` is implied by `--json`.

Pre-uninstall **drift check** compares the current pack contents against `.agentsmesh-install-manifest.json`. When drift is detected, a modified-files prompt offers `[d]elete-anyway / [k]eep-modified / [a]bort`; `--force` defaults to `[d]`. Legacy packs (no manifest) auto-migrate at uninstall time — current contents become the baseline; a warning makes this explicit. Exit `130` on user-aborted prompt; `0` on success or `--dry-run`.

**Mid-batch failure isolation** — if `applyUninstall` throws for one pack, survivors continue. The failure lands in a new `data.failed[]` envelope; post-operation `generate` still runs over the packs that succeeded so the tool tree stays consistent with the (possibly partially mutated) `installs.yaml`. Exit code is `1` when any pack failed.

**`--dry-run uninstall` is a true no-op** — the legacy-manifest migration computes the baseline in memory but does NOT persist `.agentsmesh-install-manifest.json` to disk under `--dry-run`.

### `agentsmesh installs list` (NEW)

Read-only inventory. Reads `installs.yaml`, hydrates `installed_at` + `source_type` from each pack's manifest, and emits either a space-padded `NAME / SOURCE / FEATURES / INSTALLED` table or a JSON envelope. Empty list exits 0. Forward-slash `pack_path`. `--global` reads from `~/.agentsmesh/installs.yaml`. The plural-vs-singular typo (`installs` vs `install`) surfaces a "did you mean `install`?" hint on unknown subcommands. Help banner comes from the central `help-data.ts` (single source of truth).

## Reliability fixes (broken-link rewriter)

Two silent data-corruption bugs in the skill-pack broken-link `[i]nclude` flow are now fixed:

- **Verbatim destination matching** — body rewrites match `ScannedLink.raw` (the as-authored text), not a normalized form. Bodies authored with `{baseDir}/foo.md` or Windows-style `..\refs\x.md` previously copied the supporting file but silently skipped the body rewrite, leaving an orphan `references/<basename>` plus a still-broken link. Both forms now rewrite correctly.
- **Basename-collision disambiguation** — two distinct outside paths sharing a basename (`docs/A/README.md` + `docs/B/README.md` → `references/README.md`) previously dropped the second file's bytes and pointed both citations at the same target. Names are now slugged from the full `resolvedRelative` on collision (`references/docs-A-README.md`, `references/docs-B-README.md`).

## Drift-detection robustness

- **CRLF / BOM normalization** — `hashFileForManifest` (`src/utils/crypto/hash.ts`) normalizes `\r\n?` → `\n` and strips a leading UTF-8 BOM for text-extension files (`.md`, `.json`, `.yaml`, etc.) before hashing. A Windows editor saving CRLF or a tool prepending a BOM no longer registers as drift. Binary files are still hashed as raw bytes.
- **Symlink-safe traversal** — install-time pack hashing and uninstall-time drift detection now use `readDirRecursiveNoSymlinks`. A symlink that used to be followed at install (silently absorbing external bytes into the hash) only to be unlinked-without-following at uninstall (`rm` removes the link, not the target) no longer produces a permanent drift-detection mismatch.

## Published JSON Schemas (NEW)

Two new entries in the published `schemas/` directory (already shipped via `package.json`'s `files` array) cover the two new file formats introduced in this release:

| File | Documents |
|---|---|
| `schemas/installs.json` | `.agentsmesh/installs.yaml` — the install manifest that records every materialized pack so `--sync` can replay them post-clone. |
| `schemas/install-manifest.json` | `.agentsmesh/packs/<name>/.agentsmesh-install-manifest.json` — per-pack integrity manifest (install-time provenance + per-file `sha256:` map used by `uninstall` to detect locally-modified files). |

Both schemas are generated from their respective Zod sources (`installManifestSchema` in `src/install/core/install-manifest.ts`; `installManifestFileSchema` in `src/install/manifest/install-manifest-hash.ts`) and verified by the existing schema-freshness test, which now covers all seven published schemas (was five).

Editors / GitHub schema validators that wire `$schema: https://unpkg.com/agentsmesh/schemas/installs.json` (or the corresponding install-manifest URL) get autocomplete and validation for these files; CI tools can use them to assert pack provenance without hand-coded JSON-shape checks. `buildAllSchemas()` and the `pnpm schemas:generate` script now produce **7 JSON schemas** instead of 5.

## MCP server — pack lifecycle tools (NEW)

The built-in `agentsmesh mcp` server now exposes three additional tools so AI agents speaking MCP can install, uninstall, and inspect community packs without leaving the conversation:

| Tool | Purpose |
|---|---|
| `install` | Install a community pack from a URL or local path. Auto-classifies the source layout; `target` / `as` overrides the classifier. |
| `uninstall` | Remove one or more installed packs. Mid-batch failures isolated; survivors continue. |
| `installs_list` | Read-only inventory of installed packs (also exposed as `agentsmesh://installs` resource). |

All three run with `force: true` internally — MCP has no stdin TTY, so the documented `--force` defaults are accepted for every interactive prompt the CLI would surface (bulk select → accept all, broken-link → leave-with-warnings, modified-files → delete-anyway). Input shapes mirror the CLI flags one-for-one; output envelopes match `InstallData` / `UninstallData` / `InstallsListData`.

Tool count moves from **41 → 44**; resource count moves from **16 → 17**. The MCP docs reference and the in-tree `register` / `tool-tables-sweep` contract tests are updated to match.

## Programmatic / JSON-envelope additions (additive)

New required fields on public types. JSON readers are unaffected (additive); TypeScript code constructing these types directly needs to populate the new fields:

| Type | New field |
|---|---|
| `UninstallData` | `failed: Array<{ name; reason }>` |
| `UninstallRemovedEntry` | `partial: boolean` |
| `AppliedRemoval` | `partial: boolean` |

`partial` lets JSON consumers distinguish a fully-clean removal from one where bytes were kept by design (`--keep-pack`, `[k]eep-modified`) or where a step silently no-op'd (no matching extends row, missing pack dir, etc.).

## Descriptor-driven target dispatch (internal refactor)

Several install-layer behaviours that previously branched on hardcoded target IDs in shared code now read directly from the relevant target descriptor:

- **Native-format detection** — `src/config/resolve/native-format-detector.ts` walks `descriptor.detectionPaths` instead of a hand-maintained per-target table.
- **Native importer dispatch** — `src/install/native/native-importers.ts` looks up the importer via the descriptor registry.
- **Command directories** and **starter exclusions** — derived from each descriptor's `managedOutputs.dirs` and `excludeFromStarterInit` flag.
- **Conversion defaults** — `commands_to_skills` / `agents_to_skills` defaults now live on each descriptor's `conversionDefaults`, removing duplicated per-target enable lists.
- **Path-to-target hint map** — built at module load from descriptor `managedOutputs.dirs` patterns matching `^\.[^/]+\/(rules|commands|agents|skills)$`.

Plugin descriptors transparently inherit all of these capabilities.

## Schema tightening (BREAKING for plugin authors)

**`validateDescriptor()` now requires `metadata`:**

```ts
metadata: {
  displayName: string;
  category: 'cli' | 'ide' | 'agent-platform';
  officialUrl: string;
  shortDescription: string;
}
```

Plugins built against earlier versions will fail to register at runtime until the descriptor adds the `metadata` block. All bundled plugin fixtures + the 30 built-in target descriptors already include it.

The Zod schema also now models `emitScopedSettings`, `mergeGeneratedOutputContent`, `postProcessHookOutputs`, and `preservesManualActivation` (previously laundered away by a `passthrough()` + cast).

## Operational polish

- **`AGENTSMESH_MAX_TARBALL_MB`** env var caps GitHub tarball acceptance (default 500, range 1-4096). Set higher for large monorepo installs.
- **`AGENTSMESH_STRICT_PLUGINS=1`** turns plugin descriptor import failures from warning-and-skip into hard errors (CI gate).
- **Best-effort post-install / uninstall generate** — when the post-operation `generate` pass fails (e.g. lock contention), the surrounding `install` / `uninstall` exits cleanly with a warning rather than reverting the install/uninstall work.
- **First-time install on a fresh project** — `acquireInstallLock` now `mkdir`s the canonical dir before writing the lockfile, eliminating an ENOENT failure when no `.agentsmesh/` exists yet.
- **`agentsmesh install --json` and `agentsmesh uninstall --json`** — validation errors and per-pack failures no longer leak to stderr; they go only into the JSON envelope's `error` / `failed[]` fields. Wrappers that were grepping stderr for error text should read the envelope.
- **Forward-slash paths** — every CLI display string normalizes `\\` → `/`.

## Internals

New files (selection): `src/install/classify/{types,signals,classify-source,layout-detect,layout-types,marketplace-manifest}.ts` and `src/install/classify/detectors/{fs-helpers,root-shape,collections}.ts`; `src/install/importers/{boilerplate-filter,entity-importers}.ts`; `src/install/lock/install-lock.ts`; `src/install/prompts/{prompt-io,prompt-types,bulk-prompt,broken-link-prompt,modified-files-prompt}.ts`; `src/install/links/{scan-relative-links,resolve-link}.ts`; `src/install/manifest/install-manifest-hash.ts`; `src/install/picker/select-candidates.ts`; `src/install/run/{single-pack-install,route-picker-result,run-install-marketplace,run-install-prompts,run-install-sync-locked,post-install-generate,install-abort-error}.ts`; `src/install/uninstall/{plan-uninstall,detect-modified,legacy-manifest-migration,uninstall-decisions,apply-uninstall,uninstall-result,run-uninstall}.ts`; `src/install/core/{install-target,install-report,pick-reuse-entry-name,remove-extend-entry}.ts`; `src/sources/anthropic-skill-pack/{index,aggregate,merge-commands,link-scan,apply-decisions}.ts`; `src/cli/commands/{uninstall,installs,installs-list}.ts`; `src/cli/renderers/{uninstall,installs}.ts`; `src/utils/filesystem/fs-traverse.ts::readDirRecursiveNoSymlinks`; `src/utils/crypto/hash.ts::hashFileForManifest`.

File-size discipline (per the project's 200-line cap): `layout-detect.ts` (244 → 116 lines) split into `detectors/` modules; `run-install-locked.ts` (295 → 180 lines) split into `single-pack-install.ts` + `route-picker-result.ts`.

Coverage: unit-test branch coverage held at 95% across the included set. New: 30+ unit suites and 17 integration tests covering anthropic-pack imports, broken-link / bulk prompt force paths, targeted overrides, backcompat across 5 tool-native fixtures, pack-name preservation, atomicity, every uninstall scenario, `installs list` round-trip, lock contention, marketplace recursion, failure-isolation, dry-run no-op, and CRLF/BOM/symlink hash invariants. Watch-test scheduler envelope hardened (chokidar polling forced in test harness; describe-level timeouts widened).

Docs: new `cli/uninstall.mdx`, `cli/installs.mdx`, `guides/installing-skill-packs.mdx`, and `docs/architecture/install.md`; expanded `cli/install.mdx`; README env-var table; lessons-file additions documenting the lenient-frontmatter contract, the circular-import trap in target descriptor evaluation, and the FSEvents flake fix.

## Upgrade notes

1. **Plugin authors must add a `metadata` block** to each `TargetDescriptor`. Validation rejects descriptors without it.
2. **Packs installed before this version** may report some text files as `modified` on the first `uninstall` after upgrade if their content contains CRLF or a BOM. The standard `[d]elete-anyway / [k]eep-modified / [a]bort` prompt covers it (or use `--force` to accept the default). No data is lost. Installs created after upgrade use the new hashing algorithm consistently.
3. **CI wrappers parsing `--json`** should read errors from the envelope's `error` field rather than scraping stderr.

## Deferred to a follow-up

`src/install/native/native-path-pick-infer.ts` still hardcodes per-target dir prefixes for 8 targets (`gemini-cli`, `claude-code`, `cursor`, `copilot`, `windsurf`, `cline`, `continue`, `junie`, `codex-cli`). The descriptor-driven refactor touches all 27 builtin descriptors plus the three bespoke-layout targets and is tracked separately in `tasks/todo.md`. The file remains in the coverage exclude list with a `category 5` comment until refactored.
