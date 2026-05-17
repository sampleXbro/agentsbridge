---
'agentsmesh': minor
---

Skill-pack-aware install pipeline + new `uninstall` and `installs` commands. Additive only — existing CLI surface, exit codes, and behavior contracts are unchanged.

**`agentsmesh install <url>`** — auto-detects three source shapes via a multi-signal classifier and dispatches accordingly:

- `anthropic-skill-pack`: imports root `skills/`, `agents/`, `references/`, merged per-target `.claude/commands/` + `.gemini/commands/`, and multi-tool rule files as a single bulk set. One command imports the full pack (e.g. all 23 skills + 3 agents + 7 commands of `addyosmani/agent-skills`); pre-change behavior was 7+1 with `--as`.
- `canonical-agentsmesh`: unchanged.
- `tool-native`: unchanged (5 fixtures pin the discriminator threshold so legacy repos take their original path).
- `unknown`: unchanged canonical-slice fallback.

Discriminator threshold (sum of matched signal weights ≥ 1.4 with the PRIMARY `skills/<kebab>/SKILL.md` signal present) makes false positives essentially impossible on tool-native or canonical repos. `--target` and `--as` keep their explicit-override semantics and skip the classifier.

When classified as a skill pack, two new interactive prompts surface (TTY only):

- **Bulk select (A1, three tiers)** — summary banner `[a]ll / [n]one / [s]elect per type` → per-type `[y/n/c]` → per-entity `[y/N/a=accept-all-remaining/q=skip-all-remaining]`. `--force`, `--json`, non-TTY accept everything.
- **Broken-link (B1, three options)** — when a body references files outside its import scope, classify each as in-tree-included / resolvable-outside / unresolvable and cluster per entity. `[i]nclude resolvable as supporting files / [l]eave with warnings / [a]bort install`. `--force` defaults to `[l]eave-with-warnings`.

Pack writes are atomic via staging-dir + rename. Each install now writes `.agentsmesh-install-manifest.json` next to the pack with the install-time `name`, `source`, `installed_at`, classifier verdict (`source_type`), and per-file `sha256:` map. Pack-name preservation across https / ssh / `github:` URL variants is unified via `findExistingInstallName`, keyed on canonical `github:<org>/<repo>` plus identity scope (target + as + features).

**`agentsmesh uninstall <name>[,<name>...]`** — NEW. Removes one or more installed packs:

- `rm -rf .agentsmesh/packs/<name>/`.
- Drops the row from `installs.yaml`.
- Drops the matching `extends:` row from `agentsmesh.yaml` when present (`install --extends` is now uninstallable).
- Runs `generate` so `cleanupStaleGeneratedOutputs` evicts orphaned target files.

Flags: `--all`, `--keep-pack` (leave pack on disk; only drop yaml entries), `--keep-generated` (skip the final generate; warn about stale targets), `--global`, `--dry-run`, `--force`, `--json`. The `--keep-pack` flag also doubles as the apply-layer equivalent of the interactive `[k]eep-modified` action.

Pre-uninstall drift check compares the current pack contents against `.agentsmesh-install-manifest.json`. When drift is detected, the new modified-files prompt offers `[d]elete-anyway / [k]eep-modified / [a]bort`; `--force` defaults to `[d]`. Legacy packs (no manifest) auto-migrate at uninstall time — current contents become the baseline; warning makes this explicit. Exit 130 on user-aborted prompt; exit 0 on success or `--dry-run`.

**`agentsmesh installs list`** — NEW read-only inventory. Reads `installs.yaml`, hydrates `installed_at` + `source_type` from each pack's manifest, and emits either a space-padded NAME / SOURCE / FEATURES / INSTALLED table or a JSON envelope. Empty list exits 0. Forward-slash `pack_path`. `--global` reads from `~/.agentsmesh/installs.yaml`. The plural-vs-singular typo (`installs` vs `install`) surfaces a "did you mean `install`?" hint on unknown subcommands.

**Concurrent-install lock** — `.agentsmesh/.install.lock` is acquired at the top of any `install` or `uninstall` run (and held across `--sync` replay). Concurrent invocations on the same project fail fast with `LockAcquisitionError` rather than racing on filesystem writes.

**Internals**

- New: `src/install/classify/{types,signals,classify-source}.ts`, `src/install/importers/{boilerplate-filter,entity-importers}.ts`, `src/install/lock/install-lock.ts`, `src/install/prompts/{prompt-io,prompt-types,bulk-prompt,broken-link-prompt,modified-files-prompt}.ts`, `src/install/links/{scan-relative-links,resolve-link}.ts`, `src/install/manifest/install-manifest-hash.ts`, `src/install/uninstall/{plan-uninstall,detect-modified,legacy-manifest-migration,uninstall-decisions,apply-uninstall,uninstall-result,run-uninstall}.ts`, `src/install/core/remove-extend-entry.ts`, `src/sources/anthropic-skill-pack/{index,aggregate,merge-commands,link-scan,apply-decisions}.ts`, `src/cli/commands/{uninstall,installs,installs-list}.ts`, `src/cli/renderers/{uninstall,installs}.ts`.
- Modified: install pipeline acquires `.install.lock`, threads the classifier through discovery, dispatches to the aggregate when applicable, and writes the install manifest alongside `pack.yaml`. Existing parsers gain a defensive boilerplate filter (canonical parsers unchanged — applied at the install layer only).
- Tests: 30+ new unit suites; 17 new integration files covering anthropic-pack imports, broken-link / bulk prompt force paths, targeted overrides, backcompat across 5 tool-native fixtures, pack-name preservation, atomicity, every uninstall scenario, `installs list` round-trip, and lock contention. No existing test changed its expected output.
- Docs: new `cli/uninstall.mdx`, `cli/installs.mdx`, `guides/installing-skill-packs.mdx`, and `docs/architecture/install.md`; expanded `cli/install.mdx` and the README.

**Backward compatibility** — preserved on every existing flag combination. Classifier precision (multi-signal threshold) means no env-var escape hatch is needed.
