# Skill-Pack-Aware Install + Uninstall

**Created:** 2026-05-16
**Revised:** 2026-05-16 (rev 4 — merged single plan)
**Status:** Draft — ready for implementation kickoff.
**Locked decisions:** A1 (two-tier bulk prompt), B1 (relative-only broken-link with three options), C1 (skill-pack wins, merge from tool dirs), broken-link `--force` default `[l]eave-with-warnings`, info-level logging, `--target` keeps explicit-override semantics, single branch / single PR.
**Backward compatibility:** hard constraint — public CLI signature, behavior, and contract unchanged. New behavior is additive only, gated by a precise multi-signal discriminator. **No env-var escape hatch** (discriminator precision removes the need).

---

## Goals

1. `agentsmesh install <url>` of an Anthropic-style skill pack (e.g. `addyosmani/agent-skills`) imports all 23 skills + 3 agents + 7 commands in a single command, with cross-references resolved.
2. Targeted (`<url>/<subpath>` or `--as`) and bulk (interactive) install modes coexist in one code path.
3. Pack name preserved across equivalent source URLs (https / ssh / `github:` shorthand) so scripts and `extends:` entries don't break.
4. Broken relative links in markdown bodies surface as user prompts (auto-include / leave-warn / abort), never silent corruption.
5. `agentsmesh uninstall <name>` cleanly reverses installs: pack files, manifest entries, extends entries, generated outputs (via existing `cleanupStaleGeneratedOutputs`).
6. `agentsmesh installs list` exposes installed pack names so users can target uninstall without reading `installs.yaml`.
7. `.agentsmesh-install-manifest.json` records per-file hashes at install time so uninstall detects local modifications.
8. Legacy packs (installed pre-change) auto-migrate to manifest format on first uninstall touch.
9. `.agentsmesh/.install.lock` prevents concurrent install/uninstall corruption.
10. Pre-existing `README.md` pollution in `parseAgents` is fixed; defensive boilerplate filtering across all entity parsers.
11. No existing test or fixture changes its expected outputs. Five tool-native repos produce byte-identical canonical content pre/post.

---

## Architecture

```
agentsmesh install <url>[/<subpath>] [--as <kind>] [--path ...] [--target <id>] [--force] [--dry-run]
        │
        ▼
acquire .agentsmesh/.install.lock
        │
        ▼
parse-install-source.ts ──(existing)── contentRoot
        │
        ▼
classify-source.ts ──(NEW)── Classification { type, score, signals[] }
        │   signals.ts predicates:
        │     PRIMARY (1.0):  skills/<kebab>/SKILL.md with frontmatter
        │     SECONDARY:      agents/*.md w/frontmatter      (0.4)
        │                     references/*.md                (0.3)
        │                     ≥2 of CLAUDE/AGENTS/GEMINI.md  (0.3)
        │                     .claude|.gemini|.cursor/commands/ (0.4)
        │   Threshold: PRIMARY met AND total ≥ 1.4 → anthropic-skill-pack
        │   .agentsmesh/ at root → canonical-agentsmesh (explicit wins)
        │   else → tool-native (existing) or unknown (canonical-slice fallback)
        ▼
--target or --as set?  ─── YES ──▶  existing native-importer path (unchanged)
        │ NO
        ▼
SourceType dispatch
   ├─ canonical-agentsmesh   ──▶  loadCanonicalFiles() (existing)
   ├─ anthropic-skill-pack   ──▶  aggregate.ts (NEW)
   ├─ tool-native            ──▶  existing native-importer
   └─ unknown                ──▶  loadCanonicalSliceAtPath() (existing)
        │
        ▼
aggregate.ts (skill-pack only)
   │ importSkills() → importAgents() → importCommands() → importRules()
   │   each applies boilerplate-filter.ts (NEW shared)
   │ mergeFromToolDirs: .claude/commands + .gemini/commands (claude precedence, logged)
   │ link validator: scan-relative-links.ts + resolve-link.ts (NEW)
   │ bulk-prompt.ts (NEW: A1 two-tier)
   │ broken-link-prompt.ts (NEW: B1 three-option, --force defaults to [l])
        │
        ▼
findExistingInstallName() ──(NEW)── reuse pack name if same source URL (normalized)
        │
        ▼
pack-writer.ts: staging-dir + rename atomic write to .agentsmesh/packs/<name>/
        │ also writes .agentsmesh-install-manifest.json with per-file sha256 hashes
        ▼
installs.yaml update
        │
        ▼
release .install.lock
        │
        ▼
generate ──(existing)── target trees + .agentsmesh/.lock


agentsmesh uninstall <name>[,<name>...] [--all] [--keep-pack] [--keep-generated]
                                        [--force] [--dry-run] [--json] [--global]
        │
        ▼
acquire .agentsmesh/.install.lock
        │
        ▼
plan-uninstall.ts ──── compute removal set
   │ pack files       (.agentsmesh/packs/<name>/)
   │ manifest entry   (installs.yaml)
   │ extends entry    (agentsmesh.yaml, if --extends used at install)
        │
        ▼
detect-modified.ts ──── compare current pack files vs .agentsmesh-install-manifest.json
   │ legacy pack (no manifest) → auto-generate baseline via legacy-manifest-migration.ts
   │ modification mismatches → prompt unless --force (defaults to [d]elete-anyway)
        │
        ▼
apply-uninstall.ts ──── execute removals
   │ rm-rf pack dir (unless --keep-pack)
   │ remove installs.yaml entry
   │ remove extends entry from agentsmesh.yaml (if applicable)
        │
        ▼
release .install.lock
        │
        ▼
generate ──(existing)── re-render; cleanupStaleGeneratedOutputs removes orphaned target files
   │ unless --keep-generated (then emit warning listing now-stale target paths)


agentsmesh installs list [--global] [--json]
        │
        ▼
read installs.yaml → render text table or JSON
        │ read-only; no writes; no prompts; no network
        │ exits 0 with empty list when manifest missing or empty
```

---

## Module Layout

### New files (22 product files, each ≤200 LOC)

```
src/install/classify/
  signals.ts                       ~80 LOC   pure per-signal predicates
  classify-source.ts               ~100 LOC  composes signals → SourceType
  types.ts                         ~50 LOC   SignalName, Signal, SourceType, Classification
  signals.test.ts
  classify-source.test.ts

src/install/importers/
  boilerplate-filter.ts            ~50 LOC   shared filename filter (extracted from skill-repo-filter)
  entity-importers.ts              ~180 LOC  importRules, importCommands, importAgents, importSkills
  boilerplate-filter.test.ts
  entity-importers.test.ts

src/install/prompts/
  prompt-io.ts                     ~40 LOC   testable stdin/stdout adapter
  bulk-prompt.ts                   ~150 LOC  A1 two-tier
  broken-link-prompt.ts            ~80 LOC   B1 three-option, --force defaults to [l]
  modified-files-prompt.ts         ~60 LOC   uninstall modification prompt
  bulk-prompt.test.ts
  broken-link-prompt.test.ts
  modified-files-prompt.test.ts

src/install/links/
  scan-relative-links.ts           ~60 LOC   regex extract inline + reference-style + image
  resolve-link.ts                  ~80 LOC   classify in-tree / resolvable-outside / unresolvable
  scan-relative-links.test.ts
  resolve-link.test.ts

src/install/lock/
  install-lock.ts                  ~60 LOC   acquire/release .agentsmesh/.install.lock
  install-lock.test.ts

src/install/uninstall/
  run-uninstall.ts                 ~150 LOC  orchestrator
  plan-uninstall.ts                ~180 LOC  pure: compute removal set
  detect-modified.ts               ~100 LOC  hash comparison
  apply-uninstall.ts               ~180 LOC  execute removals
  install-manifest-hash.ts         ~80 LOC   hash pack files at install + uninstall
  legacy-manifest-migration.ts     ~80 LOC   auto-generate manifest for legacy packs
  plan-uninstall.test.ts
  detect-modified.test.ts
  install-manifest-hash.test.ts
  legacy-manifest-migration.test.ts

src/sources/anthropic-skill-pack/
  index.ts                         ~100 LOC  descriptor: importers + mergeFromToolDirs
  aggregate.ts                     ~150 LOC  orchestrates classify → import → merge → links
  fixtures/                                  test fixtures
  index.test.ts
  aggregate.test.ts

src/cli/commands/
  uninstall.ts                     ~80 LOC   thin CLI wrapper
  installs.ts                      ~40 LOC   subcommand dispatcher (only `list` for now)
  installs-list.ts                 ~120 LOC  list implementation (text + json)
  installs-list.test.ts
```

### Modified files

```
src/install/source/skill-repo-filter.ts        Re-export REPO_BOILERPLATE_FILES from boilerplate-filter; deprecate local copy
src/canonical/features/agents.ts               parseAgents() applies boilerplate-filter (was including README.md)
src/canonical/features/skills.ts               parseSkills() applies boilerplate-filter (defensive)
src/canonical/features/commands.ts             parseCommands() applies boilerplate-filter (defensive)
src/canonical/features/rules.ts                parseRules() applies boilerplate-filter (defensive)
src/install/core/install-discovery.ts          Insert classifier dispatch before native-importer path
src/install/core/install-name.ts (or equiv.)   Add findExistingInstallName(manifest, parsedSource): string | null
src/install/run/run-install.ts                 Thread classification + acquire install-lock
src/install/pack/pack-writer.ts                Staging-dir + rename atomicity; write .agentsmesh-install-manifest.json
src/cli/commands/install.ts (verify path)      --help text additions only
src/cli/cli.ts (or equivalent dispatcher)      Register `uninstall` and `installs` commands
```

### Integration test fixtures

```
tests/fixtures/anthropic-skill-pack-minimal/   Synthetic minimal Anthropic pack
tests/fixtures/agent-skills-pinned/            Pinned snapshot of addyosmani/agent-skills @ 5b4c6da
tests/fixtures/tool-native-baselines/          5 representative tool-native repos for backcompat
  claude-code/, cursor/, gemini-cli/, copilot/, opencode/
tests/fixtures/legacy-pack/                    Pack dir lacking .agentsmesh-install-manifest.json
```

### Integration tests

```
tests/integration/
  install-anthropic-pack.test.ts                NEW
  install-bulk.test.ts                          NEW
  install-broken-link.test.ts                   NEW
  install-targeted.test.ts                      NEW
  install-backcompat.test.ts                    NEW
  install-pack-name-preservation.test.ts        NEW
  install-atomicity.test.ts                     NEW
  uninstall-basic.test.ts                       NEW
  uninstall-modified.test.ts                    NEW
  uninstall-missing.test.ts                     NEW
  uninstall-extends.test.ts                     NEW
  uninstall-dry-run.test.ts                     NEW
  uninstall-all.test.ts                         NEW
  uninstall-keep-generated.test.ts              NEW
  uninstall-legacy-pack.test.ts                 NEW
  install-uninstall-concurrent.test.ts          NEW
  installs-list.test.ts                         NEW
```

**File-count summary:** 22 new product files, 11 modified files, 17 integration tests, 4 fixture trees. All product files ≤200 LOC.

---

## Public CLI Surface

### `agentsmesh install` — UNCHANGED signature, additive behavior

```
agentsmesh install <source> [flags]

<source>                     GitHub/GitLab/tree/blob URL, git+ URL, SSH, or local path
                             (URL may include a /<subpath> tail for targeted install)
--path <dir>                 Subdirectory inside source repo
--as <kind>                  Force entity kind: rules | commands | agents | skills (overrides auto-detection)
--target <id>                Force tool-native interpretation (existing flag, unchanged semantics)
--name <id>                  Override generated install entry/pack name (existing)
--extends                    Write as extends entry instead of materialized pack (existing)
--sync                       Reinstall missing packs from installs.yaml (existing)
--global                     Install into ~/.agentsmesh/ (existing)
--force                      Non-interactive; accept all prompts (existing)
--dry-run                    Preview only (existing; new prompts still run, no writes)
--json                       Machine-readable output (existing; new fields additive)
```

**New optional `--json` fields (additive only):**
- `installed[].source_type` — classification result
- `installed[].source_signals` — matched signal names + score
- `installed[].prompted` — entity ids prompted on
- `installed[].skipped` — entity ids declined
- `installed[].broken_links` — `{file, link, resolution}` triples
- `installed[].command_dedups` — `{basename, winner_path, loser_paths[]}` from C1 merge

### `agentsmesh uninstall <name>[,<name>...]` — NEW

```
agentsmesh uninstall <name>[,<name>...] [flags]
agentsmesh uninstall --all [flags]

<name>                       Install entry name from installs.yaml (comma-separated for batch)
--all                        Remove every installed pack (single confirmation unless --force)
--keep-pack                  Don't delete .agentsmesh/packs/<name>/; only remove yaml/extends entries
--keep-generated             Don't run generate after removal; emit warning listing stale paths
--global                     Uninstall from ~/.agentsmesh/
--force                      Non-interactive; accept all prompts
--dry-run                    Preview removal plan; no writes
--json                       Machine-readable output
```

**Exit codes:**
- 0 — success (or dry-run preview shown)
- 1 — unrecoverable error
- 2 — no matching install entry
- 130 — user aborted at a prompt

**`--json` output shape:**
```json
{
  "mode": "uninstall",
  "removed": [
    {
      "name": "addyosmani-agent-skills",
      "pack_path": ".agentsmesh/packs/addyosmani-agent-skills",
      "manifest_entry_removed": true,
      "extends_entry_removed": false,
      "generated_files_removed": 67,
      "modified_files_kept": [],
      "legacy_migrated": false
    }
  ],
  "skipped": [],
  "dryRun": false
}
```

### `agentsmesh installs list` — NEW read-only helper

```
agentsmesh installs list [flags]

--global                     List from ~/.agentsmesh/installs.yaml
--json                       Machine-readable output
```

Read-only; no writes; no prompts; no network. Exits 0 with empty list when manifest missing or empty.

**Default (text) output:**
```
NAME                          SOURCE                                       FEATURES                  INSTALLED
addyosmani-agent-skills       github:addyosmani/agent-skills@5b4c6da       skills, agents, commands  2026-05-16
```

Forward-slash paths only (per project CLI display rule).

**Out-of-scope subcommands (forever, until a real need surfaces):** `installs show <name>`, `installs prune`, `installs verify`. Only `list` ships.

---

## Behavioral Contracts

### Source classification — multi-signal discriminator

Pure function `classifySource(contentRoot): Promise<Classification>` in `src/install/classify/classify-source.ts`.

**Signals (`src/install/classify/signals.ts`):**

| Signal | Predicate | Weight |
|---|---|---|
| `skill-pack-layout` | ≥1 `skills/<kebab>/SKILL.md` with `name` or `description` frontmatter | 1.0 (PRIMARY) |
| `agents-dir` | ≥1 `agents/<name>.md` with frontmatter (excluding boilerplate) | 0.4 |
| `references-dir` | ≥1 `references/<name>.md` | 0.3 |
| `multi-tool-rules` | ≥2 of `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` at root | 0.3 |
| `per-target-commands` | ≥1 `.md` in any of `.claude/commands/`, `.gemini/commands/`, `.cursor/commands/` | 0.4 |

**Decision rule:**
```
if exists(.agentsmesh/)                              → canonical-agentsmesh
elif PRIMARY met AND sum(matched weights) ≥ 1.4      → anthropic-skill-pack
elif matches a registered tool-native signature       → tool-native
else                                                  → unknown (loadCanonicalSliceAtPath fallback)
```

**agent-skills score:** 1.0 + 0.4 + 0.3 + 0.3 + 0.4 = **2.4** ✅
**Drive-by repo with one accidental SKILL.md:** 1.0 < 1.4 ❌

**Override behavior:** if user supplies `--target <id>` OR `--as <kind>`, classifier is skipped; existing native-importer path runs unchanged.

**Logging (info-level by default):**
```
Source classified as anthropic-skill-pack (score 2.4)
  signals: skill-pack-layout, agents-dir, references-dir, multi-tool-rules, per-target-commands
```

### Hybrid handling (C1)

When `anthropic-skill-pack` selected and tool-native dirs present, skill-pack descriptor declares:
```ts
mergeFromToolDirs: [
  { dir: '.claude/commands', target: 'claude-code', precedence: 1 },
  { dir: '.gemini/commands', target: 'gemini-cli',  precedence: 2 },
]
```

Aggregator merges command files, deduplicates by `basename(file, '.md')`. Lower `precedence` wins. **Every dedup is logged at info level** with both paths + winner. Three-way (root `commands/` also present): explicit root `commands/` wins over per-tool. Documented in `docs/architecture/install.md`.

### A1 two-tier bulk prompt

**Tier 1 — summary banner:**
```
Found in <pack-name>:
  - 23 skills
  - 3 agents
  - 7 commands
  - 1 root rule

Install [a]ll, [n]one, or [s]elect per type? [a/n/s]
```

**Tier 2 (only on `s`):** `Install all 23 skills? [y]es / [n]o / [c]hoose each`
**Tier 3 (only on `c`):** `Install skill "interview-me"? [y/N/a=accept-all-remaining/q=skip-all-remaining]`

Non-interactive (`--force`, `--json`, non-TTY): accept all entities. `--dry-run`: prompts still run; no writes.

### B1 relative-only broken-link handling

After parse + normalize, scan each entity body for relative links: `[text](path)`, `[text][id]` + `[id]: path`, `![alt](path)` where path is not `http(s)://`, `mailto:`, `tel:`, `javascript:`, absolute (`/...`), or escapes `contentRoot` via `../`. Skip links inside fenced code blocks.

Classify each:
- **in-tree-included** — target inside import scope (not broken)
- **resolvable-outside** — exists in fetched tree but outside imported subtree
- **unresolvable** — doesn't exist in fetched tree

Cluster per entity, prompt:
```
Entity "code-reviewer" (agent) has 2 broken links:
  - ../references/orchestration-patterns.md (resolvable-outside)
  - ../references/missing.md (unresolvable)

Action: [i]nclude resolvable as supporting files / [l]eave with warnings / [a]bort install
```

- `i` — copy resolvable files into `supportingFiles`; rewrite link to `./references/<x>.md`. Unresolvables left + warn.
- `l` — leave all unchanged; warn per link.
- `a` — abort entire install, no writes, exit 130.

**`--force` or non-TTY:** defaults to `[l]eave-with-warnings`.

### Pack-name preservation

`findExistingInstallName(manifest, parsedSource): string | null` in `src/install/core/install-name.ts`:
1. Normalize parsed source to canonical `github:<org>/<repo>` (strip ref, `.git`, protocol variance).
2. Iterate `manifest.installs`; normalize each entry's `source` the same way.
3. Return matching name, or `null`.

Caller in `run-install.ts` uses returned name when non-null; falls through to existing generation otherwise. Same normalization used by `uninstall <name>` lookup.

### Atomicity via staging-dir + rename

`pack-writer.ts`:
1. Write all pack files + `.agentsmesh-install-manifest.json` to `.agentsmesh/packs/.<name>.staging-<timestamp>/`
2. `fs.rename()` to `.agentsmesh/packs/<name>/`
3. Update `installs.yaml` via `writeFileAtomic`
4. On error before step 2: rm-rf staging; abort.

Pre-check at P0: confirm `writeFileAtomic` exists and is used by pack-writer.

### `.agentsmesh-install-manifest.json`

Written by pack-writer at install time. Shape:
```json
{
  "name": "addyosmani-agent-skills",
  "source": "github:addyosmani/agent-skills@5b4c6da",
  "installed_at": "2026-05-16T...",
  "extends_id": null,
  "source_type": "anthropic-skill-pack",
  "files": {
    "skills/interview-me/SKILL.md": "sha256:...",
    "skills/interview-me/examples.md": "sha256:..."
  }
}
```

Filename namespaced to avoid collision with user pack content.

### Modification detection (uninstall)

At uninstall, hash each current file in the pack dir and compare to manifest. Mismatches surface:
```
Pack "addyosmani-agent-skills" has 2 locally modified files:
  - skills/interview-me/SKILL.md (modified)
  - agents/code-reviewer.md (modified)

Action: [d]elete anyway / [k]eep modified files (uninstall the rest) / [a]bort
```

`--force` defaults to `[d]`.

### Legacy-pack migration

Pack dir exists, no `.agentsmesh-install-manifest.json`. On first uninstall touch:
1. Warn: "Legacy pack detected; cannot verify modifications. Generating baseline manifest from current contents."
2. Hash all current files → write manifest with current state as baseline.
3. Proceed as if pristine.

`--force` skips migration and deletes blindly.

### Concurrent-install lock

`.agentsmesh/.install.lock` acquired at start of any `install` or `uninstall` (pattern mirrors `.generate.lock` in `src/utils/filesystem/process-lock.ts`). Released after writes complete. If acquisition fails: emit clear error pointing to the holding PID; exit 1.

### `installs list` output

Default text: space-padded table, columns `NAME`, `SOURCE`, `FEATURES`, `INSTALLED`. Forward-slash paths. Empty list → empty output, exit 0.

JSON: `{ mode, scope, installs: [{ name, source, source_kind, source_type, version, features, target, installed_at, pack_path }] }`. Insertion order from yaml.

---

## Backward Compatibility — Guaranteed Invariants

| Scenario | Pre-change behavior | Post-change behavior | Verified by |
|---|---|---|---|
| `install <url>` of tool-native repo (no root `skills/`) | Native subset | Identical (classifier returns `tool-native`) | `install-backcompat.test.ts` × 5 fixtures |
| `install <url>` of canonical agentsmesh repo | Canonical loader | Identical (`.agentsmesh/` always wins classifier) | `install-backcompat.test.ts` |
| `install <url>` of Anthropic skill pack | Partial (7+1 for agent-skills) | **Adds** skills + agents | `install-anthropic-pack.test.ts` exact 23/3/7/1 |
| `install <url> --as <kind>` | Forced kind | Identical (classifier bypassed) | `install-targeted.test.ts` |
| `install <url> --target <id>` | Forced tool-native | Identical (classifier bypassed) | unit tests |
| `install <url> --path <subdir>` | Scoped | Classifier runs at subdir; same dispatch | `install-targeted.test.ts` |
| `install <url> --force` | Non-interactive, accept invalid | Non-interactive, accepts all NEW prompts (defaults: bulk=all, broken-link=l, modified=d) | `install-bulk.test.ts` |
| `install <url> --dry-run` | Preview, no writes | Identical; prompts still run | `install-bulk.test.ts` |
| Same URL re-installed under different protocols | Inconsistent pack names | Pack name preserved | `install-pack-name-preservation.test.ts` |
| `installs.yaml` schema | Existing fields | Existing fields + optional `source_type`, `source_signals` | schema test |
| Exit codes | 0 / 1 | + 130 on user abort (existing convention) | prompt tests |

**No env-var escape hatch needed.** Multi-signal scoring (threshold 1.4) cannot fire on legacy tool-native or canonical repos. `--target` and `--as` are documented overrides.

---

## Phases — Single Branch, Sequential Commits

### P0 — Pre-refactor (~2h)

- [ ] P0.1 Confirm `writeFileAtomic` location and usage in `pack-writer.ts`. Add if missing.
- [ ] P0.2 Locate pack-name generation function in `src/install/core/` and verify it accepts override.
- [ ] P0.3 Extract `REPO_BOILERPLATE_FILES` from `src/install/source/skill-repo-filter.ts:11-32` into new `src/install/importers/boilerplate-filter.ts` with case-insensitive `isBoilerplate(filename)`. Re-export for compat.
- [ ] P0.4 RED: `boilerplate-filter.test.ts` — case-insensitivity, full file set, kebab-case files NOT matched
- [ ] P0.5 GREEN: implement boilerplate-filter
- [ ] P0.6 Apply filter in `parseAgents`, `parseSkills`, `parseCommands`, `parseRules`
- [ ] P0.7 `pnpm test` — fix any existing test asserting old README-pollution behavior
- [ ] P0.8 Commit: `refactor(install): extract shared boilerplate filter`

### P1 — Install lock (~3h)

- [ ] P1.1 RED: `install-lock.test.ts` — acquire/release, fail-on-held, stale-lock detection
- [ ] P1.2 GREEN: implement `src/install/lock/install-lock.ts` mirroring `.generate.lock` pattern
- [ ] P1.3 Commit: `feat(install): add .install.lock for concurrent operation safety`

### P2 — Signal predicates (~4h)

- [ ] P2.1 RED: `signals.test.ts` — one test per predicate (kebab vs uppercase, empty dir, missing frontmatter, etc.)
- [ ] P2.2 GREEN: implement `src/install/classify/types.ts` + `signals.ts`
- [ ] P2.3 Commit: `feat(install): add source-classification signals`

### P3 — Multi-signal classifier (~4h)

- [ ] P3.1 RED: `classify-source.test.ts` — each `SourceType`, threshold behavior, `.agentsmesh/` precedence, drive-by repo
- [ ] P3.2 GREEN: implement `classify-source.ts`
- [ ] P3.3 Commit: `feat(install): add source classifier with multi-signal scoring`

### P4 — Entity importers + pack-name lookup (~6h)

- [ ] P4.1 RED: `entity-importers.test.ts` — `importAgents` excludes README (returns 3 from fixture); `importSkills` preserves `scripts/`; etc.
- [ ] P4.2 GREEN: implement `entity-importers.ts` (4 plain functions wrapping existing parsers + filter)
- [ ] P4.3 RED: `install-name.test.ts` — `findExistingInstallName` matches across https/ssh/`github:` variants
- [ ] P4.4 GREEN: implement `findExistingInstallName`; wire into `run-install.ts`
- [ ] P4.5 Commit: `feat(install): add entity importers and pack-name preservation`

### P5 — A1 two-tier bulk prompt (~6h)

- [ ] P5.1 RED: `prompt-io.test.ts` — injectable adapter
- [ ] P5.2 GREEN: implement `prompt-io.ts`
- [ ] P5.3 RED: `bulk-prompt.test.ts` — accept-all, skip-all, select-per-type variants, per-entity a/q shortcuts, EOF abort, --force bypass
- [ ] P5.4 GREEN: implement `bulk-prompt.ts`
- [ ] P5.5 Commit: `feat(install): add A1 two-tier bulk prompt`

### P6 — B1 link scanner + prompts (~6h)

- [ ] P6.1 RED: `scan-relative-links.test.ts` — inline, reference-style, image, anchor preservation, fenced-code skipping, `../` rejection
- [ ] P6.2 GREEN: implement `scan-relative-links.ts`
- [ ] P6.3 RED: `resolve-link.test.ts` — three classifications
- [ ] P6.4 GREEN: implement `resolve-link.ts`
- [ ] P6.5 RED: `broken-link-prompt.test.ts` — three options, per-entity clustering, `--force` defaults to `[l]`
- [ ] P6.6 GREEN: implement `broken-link-prompt.ts`
- [ ] P6.7 Commit: `feat(install): add B1 broken-link scanner and prompt`

### P7 — Anthropic skill-pack source descriptor (~4h)

- [ ] P7.1 RED: `aggregate.test.ts` — 23 skills + 3 agents (filtered) + 7 commands merged with claude precedence; conflict event emitted; include-resolvable rewrites links + adds supporting files
- [ ] P7.2 GREEN: implement `src/sources/anthropic-skill-pack/index.ts` + `aggregate.ts`
- [ ] P7.3 Commit: `feat(install): add anthropic-skill-pack source descriptor`

### P8 — Install pipeline wiring + atomicity + manifest writing (~6h)

- [ ] P8.1 RED: `install-atomicity.test.ts` — induced FS error mid-write, assert no partial pack
- [ ] P8.2 GREEN: modify `pack-writer.ts` for staging-dir + rename; write `.agentsmesh-install-manifest.json`
- [ ] P8.3 GREEN: modify `install-discovery.ts` to call classifier + dispatch to aggregate
- [ ] P8.4 GREEN: modify `run-install.ts` to acquire install-lock + thread classification
- [ ] P8.5 `pnpm typecheck && pnpm lint` GREEN
- [ ] P8.6 Commit: `feat(install): wire skill-pack classifier into install pipeline`

### P9 — Install integration tests (~1d)

- [x] P9.1 Decision: fixtures built inline in `beforeEach` (existing pattern) instead of committed under `tests/fixtures/`. Same exact counts and link topology as `agent-skills @ 5b4c6da`. Scope correction documented in run-install-prompts session handoff.
- [x] P9.2 GREEN: `install-anthropic-pack.integration.test.ts` — exact 23 skills / 3 agents / 7 commands (4 from `.claude/commands` + 3 from `.gemini/commands`) / 1 root rule counts, exact paths, manifest source_type=`anthropic-skill-pack`, sha256 file map, claude-code target outputs.
- [x] P9.3 GREEN: `install-bulk.integration.test.ts` — `--force` tier-1 [a]ll bypass. Interactive [s]/[c]/[y]/[N]/[a]/[q] scenarios remain unit-covered (no adapter-injection plumbing through `runInstall`).
- [x] P9.4 GREEN: `install-broken-link.integration.test.ts` — `--force` → `leave-with-warnings`; pack body keeps `../../references/...` paths; no `references/` supportingFile copy; project `features: [rules]` prevents post-install `generate` from validating the dangling skill link. Interactive [i]/[a] paths remain unit-covered.
- [x] P9.5 GREEN: `install-targeted.integration.test.ts` — `--as skills`, `--as agents`, `--target copilot --path .github/instructions` each bypass the classifier (`manifest.source_type === null`).
- [x] P9.6 GREEN: `install-backcompat.integration.test.ts` — 5 fixtures (claude-code, cursor, gemini-cli, codex-cli, copilot); classifier returns `tool-native` or `unknown` (never `anthropic-skill-pack`); native-importer pack outputs intact.
- [x] P9.7 GREEN: `install-pack-name-preservation.integration.test.ts` — second local install with a different `--name` does NOT create a duplicate pack; merges into the existing dir; re-install is byte-idempotent. Cross-protocol identity covered by unit tests.
- [x] P9.8 Lint + typecheck clean; 17 install integration files / 46 tests green together.
- [x] P9.9 Commit: `test(install): integration coverage for skill-pack install`

### P10 — Uninstall: plan + modification detection + legacy migration (~1d)

- [ ] P10.1 RED: `install-manifest-hash.test.ts` — deterministic ordering-independent hash, file ordering, missing files
- [ ] P10.2 GREEN: implement `install-manifest-hash.ts`
- [ ] P10.3 RED: `detect-modified.test.ts` — clean pack returns `[]`; modified returns entries; missing file returns deletion; missing manifest signals legacy
- [ ] P10.4 GREEN: implement `detect-modified.ts`
- [ ] P10.5 RED: `legacy-manifest-migration.test.ts` — generates baseline manifest from current pack state, warns user
- [ ] P10.6 GREEN: implement `legacy-manifest-migration.ts`
- [ ] P10.7 RED: `plan-uninstall.test.ts` — pack files + yaml entries + extends entries computed; `--keep-pack`/`--keep-generated`/`--all` honored
- [ ] P10.8 GREEN: implement `plan-uninstall.ts` (pure)
- [ ] P10.9 RED: `modified-files-prompt.test.ts` — three options, `--force` defaults to `[d]`
- [ ] P10.10 GREEN: implement `modified-files-prompt.ts`
- [ ] P10.11 Commit: `feat(uninstall): add planning, modification detection, and legacy migration`

### P11 — Uninstall: apply + CLI (~1d)

- [ ] P11.1 RED: `uninstall-basic.test.ts` — install then uninstall: pack gone, yaml entry gone, generate cleans targets
- [ ] P11.2 GREEN: implement `apply-uninstall.ts` + `run-uninstall.ts`
- [ ] P11.3 RED: `uninstall-modified.test.ts` — modification prompt, `--force` overrides, `[k]eep` preserves modified files
- [ ] P11.4 RED: `uninstall-missing.test.ts` — pack dir deleted manually; uninstall warns, removes manifest, exit 0
- [ ] P11.5 RED: `uninstall-extends.test.ts` — install `--extends` then uninstall: extends entry removed from agentsmesh.yaml
- [ ] P11.6 RED: `uninstall-dry-run.test.ts` — preview without writes
- [ ] P11.7 RED: `uninstall-all.test.ts` — multiple installs, single confirmation; `--force` skips prompt
- [ ] P11.8 RED: `uninstall-keep-generated.test.ts` — `--keep-generated` leaves target files, emits warning listing stale paths
- [ ] P11.9 RED: `uninstall-legacy-pack.test.ts` — legacy pack triggers migration, proceeds
- [ ] P11.10 GREEN: register `uninstall` command in CLI dispatcher; implement `src/cli/commands/uninstall.ts` thin wrapper
- [ ] P11.11 Iterate to GREEN
- [ ] P11.12 Commit: `feat(uninstall): add uninstall command and integration tests`

### P12 — installs list + concurrent-install integration (~6h)

- [ ] P12.1 RED: `installs-list.test.ts` — empty manifest → empty; one entry → text + json; multiple → ordered; `--global` reads home; forward-slash paths
- [ ] P12.2 GREEN: implement `src/cli/commands/installs-list.ts` + `installs.ts` subcommand dispatcher
- [ ] P12.3 Register `installs` in CLI dispatcher
- [ ] P12.4 RED: `installs-list.test.ts` (integration) — after install, list shows entry; after uninstall, list empty
- [ ] P12.5 RED: `install-uninstall-concurrent.test.ts` — two parallel installs on same project: second fails fast with lock error; data integrity preserved
- [ ] P12.6 GREEN: iterate to GREEN
- [ ] P12.7 Commit: `feat(installs): add installs list command and concurrent-install lock test`

### P13 — Documentation + changeset (~6h)

- [ ] P13.1 Update `README.md`: replace install paragraph with `## Install` section (bulk + targeted modes, all flags, A1 transcript, broken-link transcript, skill-pack walkthrough using agent-skills). Add `## Uninstall` section. Add `## Listing installs` subsection.
- [ ] P13.2 Update `website/src/content/docs/reference/install.mdx` (verify path)
- [ ] P13.3 NEW `website/src/content/docs/reference/uninstall.mdx`
- [ ] P13.4 NEW `website/src/content/docs/guides/installing-skill-packs.mdx`
- [ ] P13.5 NEW `docs/architecture/install.md`: contributor internals (signal scoring, classifier dispatch, entity importers, link resolution, hybrid handling, atomicity, manifest format, lock model)
- [ ] P13.6 Update `--help` output for `install`; register `uninstall` and `installs` in help dispatcher
- [ ] P13.7 NEW `.changeset/skill-pack-aware-install.md` — minor bump describing additive install behavior, new uninstall command, new installs list helper, multi-signal discriminator
- [ ] P13.8 `pnpm --dir website build` GREEN
- [ ] P13.9 Commit: `docs(install): document skill-pack-aware install and uninstall`

### P14 — Final verification gate

- [ ] V1: `pnpm lint` clean
- [ ] V2: `pnpm typecheck` clean
- [ ] V3: `pnpm typecheck:tests` clean
- [ ] V4: `pnpm test` full suite GREEN — zero regressions
- [ ] V5: `pnpm test:e2e` full GREEN
- [ ] V6: `pnpm matrix:verify` clean
- [ ] V7: `pnpm --dir website build` GREEN
- [ ] V8: Manual end-to-end against live `addyosmani/agent-skills`:
  - `agentsmesh init`
  - `agentsmesh install https://github.com/addyosmani/agent-skills` (bulk, accept all)
  - `agentsmesh installs list` — shows entry
  - `agentsmesh generate --targets cursor,claude-code,opencode`
  - inspect `.cursor/skills/`, `.claude/skills/`, `.opencode/skills/` — exactly 23 skills each
  - `agentsmesh uninstall addyosmani-agent-skills`
  - `agentsmesh installs list` — empty
  - confirm pack dir, manifest entry, generated trees all clean
- [ ] V9: Append discoveries to `tasks/lessons.md`
- [ ] V10: PR title: `feat(install): skill-pack-aware install + uninstall + installs list`

---

## Edge Cases & Handling

| Edge case | Handling | Test |
|---|---|---|
| Same-name conflict `.claude/commands/foo.md` vs `.gemini/commands/foo.md` | Default claude wins; descriptor-overridable; info log with both paths | `aggregate.test.ts` |
| Three-way: root `commands/` + `.claude/commands/` + `.gemini/commands/` | Explicit root `commands/` wins over per-tool | doc'd; `aggregate.test.ts` |
| `.agentsmesh/` AND root `skills/` both present | `canonical-agentsmesh` wins | `classify-source.test.ts` |
| `skills/foo/` empty (no SKILL.md) | Primary signal scores 0; not skill-pack | `signals.test.ts` |
| Mid-install Ctrl-C | Prompts run before disk writes; staging-dir + rename; abort leaves no state | bulk-prompt abort scenario |
| FS error mid-write | Staging-dir + rename; rm-rf staging on error | `install-atomicity.test.ts` |
| Mid-uninstall Ctrl-C | Lock acquired; partial state detectable on next operation via manifest hash | (acceptable; documented) |
| Broken symlinks in source | Skip symlinks at discovery (`dirent.isSymbolicLink()` check) | symlink fixture test |
| Re-install idempotency | Pack-name preservation → same pack dir overwritten | `install-pack-name-preservation.test.ts` |
| Link anchor (`../refs/x.md#section`) | Strip anchor for resolution; preserve in rewrite | `resolve-link.test.ts` |
| Link escaping contentRoot (`../../foo.md`) | Reject as unresolvable (security boundary) | `resolve-link.test.ts` |
| Links inside fenced code blocks | Not extracted | `scan-relative-links.test.ts` |
| `README.MD` uppercase variant | Boilerplate filter case-insensitive | `boilerplate-filter.test.ts` |
| Skill dir name `_example` | Existing `parseSkills` skips `_`-prefixed | existing tests |
| `installs.yaml` doesn't exist (first install) | Existing path; classifier-aware flow handles same | `install-backcompat.test.ts` |
| Legacy pack uninstall | Auto-migrate (warn, hash current as baseline, proceed) | `uninstall-legacy-pack.test.ts` |
| Concurrent install attempts | Second fails fast with lock-held error | `install-uninstall-concurrent.test.ts` |
| Pack-name collision in `--all` uninstall | Detect duplicates at plan stage; fail loudly | `plan-uninstall.test.ts` |
| `--keep-pack --keep-generated` combo | Only yaml/extends entries removed; pack + targets untouched; warning | `uninstall-keep-generated.test.ts` |

---

## Out of Scope

- Multi-target generate collisions (`.agents/skills/...` shared by amp and gemini-cli). Separate fix.
- HTTP/HTTPS link validation. Future `--check-http` flag.
- TUI checkbox prompts (A3).
- Top-level `.agentsmesh/references/` canonical category. Per-entity supporting-file duplication is acceptable.
- Pack updates (`update` command). `install --force` is the upgrade path.
- `installs show <name>`, `installs prune`, `installs verify`. Future PRs if needed.
- Reference duplication consistency story (refs cited by N skills go stale silently if upstream changes). Acknowledged in changeset; revisit if users complain.

---

## Open Risks

1. **Discriminator false positives.** Multi-signal scoring (threshold 1.4) makes them essentially impossible. Verified by `install-backcompat.test.ts` × 5 fixtures.
2. **Cross-skill reference duplication blow-up.** Refs copied per-entity. For agent-skills (~40KB total). Acceptable; document in changeset.
3. **Command-dedup data loss.** Mitigated: info-log every dedup; descriptor-overridable precedence; `--json` records both paths.
4. **Reference-style link rewriting.** Spans multiple lines (`[t][id]` + `[id]: path`). Rewrite must update the definition line, not just the inline reference. Test coverage in P6.
5. **Legacy pack assumption.** Migration treats current state as pristine. User modifications since install go unflagged. Documented behavior; warning makes it explicit.
6. **`installs` vs `install` typo risk.** Plural namespace command is one character away from `install`. Mitigation: dispatcher emits "did you mean `install`?" when `installs` invoked without a subcommand; tests cover this.

---

## Spec self-review (2026-05-16, revision 4 — merged)

Checked for:
- **Placeholders:** none.
- **Internal consistency:** install flag set matches per-phase tests; uninstall flag set matches P10–P12 tasks; `installs list` flag set matches P12; backward-compat invariants table matches P9.6 verification; concurrent-lock acquisition pattern consistent across install + uninstall.
- **Scope check:** decomposed into 15 phases (P0–P14), each independently verifiable. Single branch is appropriate; total estimated effort ~7–8 working days.
- **Ambiguity:** "verify exact path" for `website/src/content/docs/reference/install.mdx` and `src/cli/commands/install.ts` — known unknowns confirmed at P0, not design ambiguities.
- **Resolved this revision:** Merged uninstall, installs list, manifest writing, concurrent lock, and legacy migration from the deferred PR2 plan into the single PR1 plan. `.agentsmesh-install-manifest.json` writing now happens during P8 (install pipeline) so uninstall (P10–P11) can rely on it. Total file count: 22 new product files, 11 modified, 17 integration tests.

Spec is ready for implementation.
