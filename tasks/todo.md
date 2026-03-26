# Packs Feature — Local Materialized Installs

# Worktree merge audit

- [x] Confirm the repo mainline branch for this workspace and record active worktrees
- [x] Identify which worktree branches are already merged into current `master`
- [x] For each unmerged worktree branch, test whether it merges cleanly into current `master`
- [x] Add review notes with merged status and any blockers

## Review (Worktree merge audit)

- Mainline branch in this repo is `master` (no `main` branch exists locally).
- Active worktrees: root `master`, `.worktrees/align-agent-structures` (`feature/align-agent-structures`), `.worktrees/feature-packs` (`feature/packs`), `.worktrees/security-collaboration` (`feature/security-collaboration`).
- `feature/packs` is already merged into `master` (`git merge-base --is-ancestor feature/packs master` succeeded). `master` is 3 commits ahead of that branch, including `feat(install): persist mcp, permissions, hooks, and ignore in materialized packs` at `817478c`.
- `feature/align-agent-structures` is not merged. Divergence from `master`: `master`-only 25 commits, branch-only 6 commits. A disposable `git merge --no-commit --no-ff feature/align-agent-structures` from current `master` produced conflicts in shared engine/reference-map/target files plus integration/e2e/unit tests.
- `feature/security-collaboration` is not merged. Divergence from `master`: `master`-only 101 commits, branch-only 9 commits. A disposable `git merge --no-commit --no-ff feature/security-collaboration` from current `master` produced conflicts in config/lock/remote-fetcher/generate paths plus related tests.

# Unmerged worktree usefulness review

- [x] Summarize what `feature/align-agent-structures` implements vs current `master`
- [x] Summarize what `feature/security-collaboration` implements vs current `master`
- [x] Identify any branch changes still worth porting into current `master`

## Review (Unmerged worktree usefulness review)

- `feature/align-agent-structures` mostly overlaps with `master`. Current `master` already has Gemini native agents and settings enablement in `src/targets/gemini-cli/generator.ts`, Gemini agent import in `src/targets/gemini-cli/importer.ts`, and Junie `.junie/AGENTS.md` plus `.junie/rules/*.md` generation in `src/targets/junie/generator.ts`.
- The only notable branch-only behavior left in `feature/align-agent-structures` is a Cline compatibility mirror that emits both `.clinerules/_root.md` and `AGENTS.md`; current `master` only emits `AGENTS.md` for the root rule in `src/targets/cline/generator.ts`. This looks optional and should be ported only if dual-root compatibility is still desired by spec.
- `feature/security-collaboration` contains branch-only collaboration/security work not present on `master`: lock-feature violation detection and `[LOCKED]` reporting, `generate --force` enforcement for `collaboration.strategy: lock`, stricter local extend validation (`.agentsmesh` must exist), remote tarball hashing/integrity sidecar propagation into lock entries, zip-slip filtering during GitHub tar extraction, and a strict mode to disable offline fallback for remote extends.
- Of those, the highest-value salvage candidates are the zip-slip filter and local-extend `.agentsmesh` validation; the collaboration lock enforcement is also useful if the product still intends to support `strategy: lock`. The tarball-hash and strict-offline pieces would need a careful port because `master` now uses split remote fetchers (`github-remote.ts` / `git-remote.ts`) and pack-aware lock generation.

# Salvage security/collaboration work + remove worktrees

- [x] Add failing tests for lock-feature enforcement and `[LOCKED]` reporting in `generate`/`check`
- [x] Evaluate local extend validation from `feature/security-collaboration` against current `master` architecture
- [x] Add failing tests for GitHub tar extraction zip-slip filtering
- [x] Implement the selected security/collaboration changes on `master`
- [x] Run targeted verification, then broader required verification
- [x] Run post-feature QA and append review notes
- [x] Remove `feature/align-agent-structures` and `feature/security-collaboration` worktrees

## Review (Salvage security/collaboration work + remove worktrees)

- Ported from `feature/security-collaboration`: locked-feature detection in `src/config/lock.ts`, `generate` enforcement for `collaboration.strategy: lock` in `src/cli/commands/generate.ts`, `[LOCKED]` conflict annotations in `src/cli/commands/check.ts`, and zip-slip filtering for GitHub tar extraction in `src/config/github-remote.ts`.
- Intentionally not ported: local extend `.agentsmesh/` validation. Current `master` supports native-format and skill-pack local extends through `src/canonical/extend-load.ts`, so resolver-level rejection would break legitimate local extends before the importer/loader can normalize them.
- Targeted tests added:
  - `tests/unit/config/lock.test.ts`
  - `tests/unit/cli/commands/generate.test.ts`
  - `tests/unit/cli/commands/check.test.ts`
  - `tests/unit/config/github-remote.test.ts`
- Verification:
  - `pnpm vitest run tests/unit/config/lock.test.ts tests/unit/cli/commands/generate.test.ts tests/unit/cli/commands/check.test.ts tests/unit/config/github-remote.test.ts`
  - `pnpm build`
  - `pnpm test`
  - `pnpm lint`
- QA Report — salvage security/collaboration work
- Acceptance criteria:
  - `strategy: lock` blocks `generate` when locked canonical features changed unless `--force` is supplied: covered by `tests/unit/cli/commands/generate.test.ts`
  - `check` highlights locked canonical drift with `[LOCKED]`: covered by `tests/unit/cli/commands/check.test.ts`
  - locked-feature path detection is feature-scoped and handles added/removed files: covered by `tests/unit/config/lock.test.ts`
  - GitHub tar extraction rejects traversal and absolute archive paths: covered by `tests/unit/config/github-remote.test.ts`
- Edge cases covered:
  - unchanged non-locked features do not trigger violations
  - added and removed files inside locked features are both flagged
  - `generate --force` bypasses lock enforcement
  - safe tar entries continue to extract while `../...` and absolute paths are rejected
- Worktrees removed with `git worktree remove --force`: `feature/align-agent-structures`, `feature/security-collaboration`

## Branch: feature/packs

- [x] Step 1: Pack schema (`src/install/pack-schema.ts`) — 10 tests ✓
- [x] Step 2: Pack reader (`src/install/pack-reader.ts`) — 12 tests ✓
- [x] Step 3: Pack hash (`src/install/pack-hash.ts`) — 6 tests ✓
- [x] Step 4: Pack writer (`src/install/pack-writer.ts`) — 6 tests ✓
- [x] Step 5: Pack merge (`src/install/pack-merge.ts`) — 6 tests ✓
- [x] Step 6: Cache cleanup + export buildCacheKey — 8 tests ✓
- [x] Step 7: Pack loader (`src/canonical/pack-load.ts`) — 8 tests ✓
- [x] Step 8: Integrate packs into `extends.ts` — 19 tests ✓
- [x] Step 9: Modify install command for pack default — 7 tests ✓
- [x] Step 10: Lock file integration — 22 tests ✓
- [x] Step 11: Watch mode awareness — already handled (packs/ is subdirectory of watched .agentsmesh/)
- [x] Step 13: Final verification — 1447 unit tests ✓, build ✓, 5 e2e failures all pre-existing on main ✓

## Install ADR alignment check

- [x] Add failing tests for ADR-required incremental pack matching when a remote source resolves to a new pinned version
- [x] Add failing tests for pack metadata refresh on incremental install (`source`, `version`, `updated_at`, and install context fields)
- [x] Implement install/pack merge changes to match `adr-packs-local-materialized-installs.md`
- [x] Run targeted unit/integration verification, then `pnpm build`
- [x] Run post-feature QA and append review notes

# Install flow coverage + pack persistence

- [x] Add failing tests for pack persistence/loading of `mcp`, `permissions`, `hooks`, and `ignore`
- [x] Add failing unit tests for `runInstall()` non-dry-run branches and key error/warn paths
- [x] Add failing integration/e2e tests for real non-dry-run pack creation and incremental update
- [x] Implement the install/pack fixes required by the new failing coverage
- [x] Run targeted verification, `pnpm build`, and append QA review notes

## Review (Install flow coverage + pack persistence)

- QA Report — Install flow coverage + pack persistence
- Acceptance criteria: default non-dry-run install now has integration + e2e coverage; incremental local pack updates are covered through the real command path; `runInstall()` key success/error branches are unit-covered; materialized packs now persist and reload `mcp`, `permissions`, `hooks`, and `ignore`.
- Edge cases covered: missing source, non-interactive without `--force`/`--dry-run`, remote install without git, missing install path, no discovered resources, empty conflict selection, generate warning path, second install updating the existing pack, and settings-feature round trip through pack write/load/merge.
- Tests: `pnpm vitest run tests/unit/install/pack-reader.test.ts tests/unit/install/pack-merge.test.ts tests/unit/install/pack-settings.test.ts tests/unit/install/pack-writer.test.ts tests/unit/install/run-install-pack.test.ts tests/unit/install/run-install.test.ts tests/unit/canonical/pack-load.test.ts tests/unit/canonical/extends.test.ts tests/unit/config/lock.test.ts tests/integration/install.integration.test.ts tests/integration/install-pack.integration.test.ts`
- E2E: `pnpm build && pnpm vitest run --config vitest.e2e.config.ts tests/e2e/install.e2e.test.ts`

## Review (Install ADR alignment)

- QA Report — Install ADR alignment
- Acceptance criteria: incremental installs now find an existing remote pack by stable source identity instead of exact pinned ref, and pack merges refresh pinned metadata (`source`, `version`, plus latest install `target/path` when provided).
- Edge cases covered: same repo new SHA still updates existing pack; no-match behavior still returns null; merge preserves existing files/features while updating metadata; install orchestration passes refreshed metadata through the merge path.
- Tests: `pnpm vitest run tests/unit/install/pack-reader.test.ts tests/unit/install/pack-merge.test.ts tests/unit/install/run-install-pack.test.ts tests/unit/canonical/pack-load.test.ts tests/unit/canonical/extends.test.ts tests/unit/config/lock.test.ts tests/integration/install.integration.test.ts`
- Build: `pnpm build`

# Native install subtree parity

- [x] Add failing tests for importer-equivalent native install scoping across supported target folder/file families
- [x] Add failing tests proving local native installs do not write `.agentsmesh/` into the source repo
- [x] Refactor install discovery to stage native imports and derive subtree selection from importer results
- [x] Expand install coverage with per-target native scope matrices plus native-target integration coverage
- [x] Run targeted verification, `pnpm build`, install e2e, `pnpm lint`, and `pnpm test`
- [x] Run post-feature QA and append review notes

## Review (Native install subtree parity)

- QA Report — Native install subtree parity
- Acceptance criteria:
  - `install` now scopes supported native agent structures from real importer results instead of hardcoded folder heuristics: covered by `tests/unit/install/native-install-scope.claude-cursor.test.ts`, `tests/unit/install/native-install-scope.copilot-continue-gemini.test.ts`, `tests/unit/install/native-install-scope.junie-cline-windsurf-codex.test.ts`, and `tests/unit/install/native-install-scope.codex.test.ts`
  - folder and file installs work across the supported native families for Claude Code, Cursor, Copilot, Continue, Gemini CLI, Junie, Cline, Windsurf, and Codex CLI: covered by the same per-target scope matrix
  - local native installs do not mutate the source checkout while discovering installable content: covered by `tests/unit/install/prepare-install-discovery.test.ts` and `tests/integration/install-native-target.integration.test.ts`
  - real pack install from a native subtree still materializes canonical pack content and regenerates target output: covered by `tests/integration/install-native-target.integration.test.ts` and `tests/e2e/install.e2e.test.ts`
- Edge cases covered:
  - explicit target and auto-detect paths both use staged native imports
  - scoped installs still work when the source repo already has `.agentsmesh/`
  - settings-only native files (`settings.json`, hooks, mcp, ignore, policies) install without array resources
  - embedded skill directories keep supporting files
  - scoped `AGENTS.md`/projected-command/projected-agent native files resolve to the correct canonical feature
  - folder paths select all imported children and file paths select single imported resources
- Verification:
  - `pnpm vitest run tests/unit/install/pack-reader.test.ts tests/unit/install/pack-merge.test.ts tests/unit/install/pack-settings.test.ts tests/unit/install/pack-writer.test.ts tests/unit/install/resource-selection.test.ts tests/unit/install/run-install-pack.test.ts tests/unit/install/run-install.test.ts tests/unit/install/prepare-install-discovery.test.ts tests/unit/install/native-install-scope.claude-cursor.test.ts tests/unit/install/native-install-scope.copilot-continue-gemini.test.ts tests/unit/install/native-install-scope.junie-cline-windsurf-codex.test.ts tests/unit/install/native-install-scope.codex.test.ts tests/unit/canonical/pack-load.test.ts tests/unit/canonical/extends.test.ts tests/unit/config/lock.test.ts tests/integration/install.integration.test.ts tests/integration/install-pack.integration.test.ts tests/integration/install-native-target.integration.test.ts`
  - `pnpm build && pnpm vitest run --config vitest.e2e.config.ts tests/e2e/install.e2e.test.ts`
  - `pnpm lint`
  - `pnpm test`

# Manual install mode + pack sync

- [x] Add failing tests for explicit `install --as ...` collection installs from non-native folders/files
- [x] Add failing tests for persisted install provenance and `install --sync` pack rehydration
- [x] Implement manual install staging, manifest persistence, and sync orchestration
- [x] Keep existing native-path auto-detection as the default when `--as` is not supplied
- [x] Run targeted verification, `pnpm build`, install e2e, `pnpm lint`, and `pnpm test`
- [x] Run post-feature QA and append review notes

## Review (Manual install mode + pack sync)

- QA Report — Manual install mode + pack sync
- Acceptance criteria:
  - explicit `install --as agents|commands|rules|skills` now installs supported collections from arbitrary folders/files instead of depending on native path heuristics: covered by `tests/integration/install-manual-as.integration.test.ts` and `tests/e2e/install.e2e.test.ts`
  - native-path auto-detection still remains the default path when `--as` is omitted: covered by the existing native subtree suites plus the unchanged install integration flow
  - successful pack installs now persist reinstall provenance in `.agentsmesh/installs.yaml`: covered by `tests/unit/install/run-install-pack.test.ts` and `tests/integration/install-manual-as.integration.test.ts`
  - `install --sync` now restores missing materialized packs from the persisted manifest without requiring a source argument: covered by `tests/unit/install/run-install.test.ts`, `tests/integration/install-sync.integration.test.ts`, and `tests/e2e/install.e2e.test.ts`
- Edge cases covered:
  - single markdown file and folder installs for manual agent/command/rule collections
  - skill installs from `SKILL.md`, a skill directory, or a directory of skill directories
  - duplicate flat filenames in manual collection mode are rejected
  - same source repo with different `path` or `as` values no longer reuses the wrong existing pack
  - sequential single-item installs from the same manual collection now amend the existing pack and persisted manifest entry instead of overwriting them with the latest file scope: covered by `tests/integration/install-manual-commands.integration.test.ts`
  - sync short-circuits normal source validation and replays saved target/path/manual mode metadata
  - sync replays persisted pinned remote sources like `github:org/repo@sha` instead of mis-parsing them as local paths
  - sync now preserves the caller's validation behavior instead of silently forcing all replayed installs
  - sync now reapplies the saved `features` and `pick` scope so subset installs do not expand back to the full folder
- Verification:
  - `pnpm vitest run tests/unit/cli/index.test.ts tests/unit/cli/help.test.ts tests/unit/install/pack-reader.test.ts tests/unit/install/pack-merge.test.ts tests/unit/install/pack-settings.test.ts tests/unit/install/pack-writer.test.ts tests/unit/install/resource-selection.test.ts tests/unit/install/run-install-pack.test.ts tests/unit/install/run-install.test.ts tests/unit/install/prepare-install-discovery.test.ts tests/unit/install/native-install-scope.claude-cursor.test.ts tests/unit/install/native-install-scope.copilot-continue-gemini.test.ts tests/unit/install/native-install-scope.junie-cline-windsurf-codex.test.ts tests/unit/install/native-install-scope.codex.test.ts tests/integration/install.integration.test.ts tests/integration/install-pack.integration.test.ts tests/integration/install-native-target.integration.test.ts tests/integration/install-manual-as.integration.test.ts tests/integration/install-sync.integration.test.ts`
  - `pnpm build && pnpm vitest run --config vitest.e2e.config.ts tests/e2e/install.e2e.test.ts`
  - `pnpm lint`
  - `pnpm test`

# Manual install edge-case matrix

- [x] Add failing unit tests for manual staging edge cases across agents, commands, rules, and skills
- [x] Add failing integration tests for bulk and single-item manual installs for each entity
- [x] Verify representative CLI install coverage still passes for manual install and sync flows
- [x] Confirm the current manual install implementation satisfies the expanded matrix without further code changes
- [x] Run targeted verification, broader QA verification, and append review notes

## Review (Manual install edge-case matrix)

- QA Report — Manual install edge-case matrix
- Acceptance criteria:
  - bulk and single-item manual installs are now covered for `agents`, `commands`, `rules`, and `skills`: covered by `tests/integration/install-manual-as.integration.test.ts`, `tests/integration/install-manual-as.markdown.integration.test.ts`, and `tests/integration/install-manual-as.skills.integration.test.ts`
  - manual staging edge cases are now covered for markdown collections and skill layouts before discovery/generation runs: covered by `tests/unit/install/manual-install-scope.markdown.test.ts` and `tests/unit/install/manual-install-scope.skills.test.ts`
  - representative CLI behavior for manual install and sync still works end-to-end after the new matrix expansion: covered by `tests/e2e/install.e2e.test.ts`
- Edge cases covered:
  - single markdown file installs for agents, commands, and rules
  - bulk folder installs for agents, commands, and rules
  - single skill installs from both `SKILL.md` and skill-directory layouts
  - bulk skill installs from a directory of skill folders with supporting files preserved
  - sequential sibling single-item installs for agents, commands, rules, and skills now amend one pack/manifest entry and persist the parent collection path plus merged pick list
  - remote single-file installs now accept GitHub/GitLab `blob` URLs instead of falling back to local-path parsing
  - duplicate markdown basenames are rejected during manual staging
  - non-markdown manual item paths are rejected for markdown collections
  - empty markdown folders are rejected
  - invalid skill paths that are neither `SKILL.md` nor a skill pack layout are rejected
  - single-item installs materialize exactly one pack entry and exactly one generated entity for the requested type
- Verification:
  - `pnpm vitest run tests/unit/install/manual-install-scope.markdown.test.ts tests/unit/install/manual-install-scope.skills.test.ts tests/unit/install/url-parser.test.ts tests/unit/install/pack-reader.test.ts tests/unit/install/run-install-pack.test.ts tests/unit/install/run-install.test.ts tests/integration/install-manual-as.integration.test.ts tests/integration/install-manual-as.markdown.integration.test.ts tests/integration/install-manual-as.skills.integration.test.ts tests/integration/install-sync.integration.test.ts`
  - `pnpm build`
  - `pnpm vitest run --config vitest.e2e.config.ts tests/e2e/install.e2e.test.ts`
  - `pnpm test`

# Stable pack naming

- [x] Add failing tests for repo-plus-feature auto-generated pack names
- [x] Replace first-picked-item pack naming with stable repo-plus-feature naming
- [x] Persist multi-path install provenance so same repo/feature installs append and sync correctly
- [x] Verify bulk, single-item, sibling-amend, sync, and full-suite behavior
- [x] Run post-feature QA and append review notes

## Review (Stable pack naming)

- QA Report — Stable pack naming
- Acceptance criteria:
  - auto-generated install pack names now use stable `repo-feature` naming instead of the first selected item: covered by `tests/unit/install/name-generator.test.ts`
  - sibling installs for agents, commands, rules, and skills from the same repo/feature append into one pack and one manifest entry: covered by `tests/integration/install-manual-commands.integration.test.ts`, `tests/integration/install-manual-as.markdown.integration.test.ts`, and `tests/integration/install-manual-as.skills.integration.test.ts`
  - installs from multiple folders in the same repo/feature replay correctly through sync: covered by `tests/integration/install-manual-multi-path.integration.test.ts`
- Edge cases covered:
  - GitHub and local installs keep the same `repo-feature` pack name regardless of which sibling item was installed first
  - manual single-file installs normalize to the parent collection path before auto-naming
  - same repo/feature installs from multiple folders aggregate their provenance in `paths` so `install --sync` can replay every saved scope
  - collection paths like `commands` or `skills` do not leak into the pack name and do not duplicate the feature suffix
  - sibling installs across agents, commands, rules, and skills keep a stable pack folder name while merging picks
- Verification:
  - `pnpm vitest run tests/unit/install/name-generator.test.ts tests/unit/install/pack-schema.test.ts tests/unit/install/pack-reader.test.ts tests/unit/install/run-install-pack.test.ts tests/unit/install/run-install.test.ts tests/unit/install/url-parser.test.ts tests/integration/install-manual-commands.integration.test.ts tests/integration/install-manual-as.markdown.integration.test.ts tests/integration/install-manual-as.skills.integration.test.ts tests/integration/install-manual-multi-path.integration.test.ts tests/integration/install-sync.integration.test.ts`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm test`

---

# Codex CLI structure alignment

- [x] Add `codexAdvisoryRuleOutputPath` (globs → nested `AGENTS.md`, else `{slug}/AGENTS.md`)
- [x] Wire generator + `ruleTargetPath` + docs/comments
- [x] Update tests (unit, integration, e2e, roundtrip, contracts, research)
- [x] `pnpm build` + targeted verification (`pnpm test` may flake watch tests when run in parallel with heavy integration tests; isolate `watch.test.ts` if needed)

# Gemini CLI structure alignment (excluding sandbox)

- [x] Keep a single primary Gemini instructions file (`GEMINI.md`) and stop emitting `.gemini/GEMINI.md` mirror
- [ ] Update gemini-cli generator/importer to preserve command namespaces under `.gemini/commands/**` (nested path -> `:` in canonical command name)
- [ ] Implement gemini-cli permissions -> policies projection (`.gemini/policies/*.toml`) from `.agentsmesh/permissions.yaml`
- [ ] Implement gemini-cli policies import back into `.agentsmesh/permissions.yaml`
- [ ] Update gemini-cli `.gemini/settings.json` generation to set `context.fileName` to include `AGENTS.md`
- [ ] Update `tests/e2e/helpers/target-contracts.ts` for gemini-cli exact generated/imported file sets
- [ ] Add/adjust unit tests for gemini-cli generator/importer (namespaced commands + policies roundtrip)
- [ ] Run `pnpm test` (or targeted vitest suites) and fix any regressions

# Junie structure alignment (project-level advanced)

- [x] Add failing tests for Junie compatibility mirrors generation (`AGENTS.md`, `.junie/guidelines.md`, optional `ci-guidelines.md`)

# Test hardening for install replay and recent regressions

- [x] Audit recent install/manual-scope regression coverage for duplicate cases and weak assertions
- [x] Add failing tests for replay-scope materialization and stricter exact-path assertions
- [x] Remove redundant/dead install test coverage and dead test helpers
- [x] Implement any production fix required by the stricter replay/install tests
- [x] Run sequential targeted verification, then broader quality gates
- [x] Run post-feature QA and append review notes

## Review (Test hardening for install replay and recent regressions)

- QA Report — install replay/manual-scope hardening
- Acceptance criteria:
  - replayed installs materialize only the replay-scoped canonical features: covered by `tests/unit/install/run-install.test.ts`
  - sync regression tests assert exact generated and pack file sets for saved picks and legacy nested skill replay: covered by `tests/integration/install-sync.integration.test.ts`
  - duplicate/dead install coverage is removed without losing behavior coverage: `tests/unit/install/manual-install-scope.test.ts` removed, with equivalent-plus-stricter coverage retained in `tests/unit/install/manual-install-scope.markdown.test.ts` and `tests/unit/install/manual-install-scope.skills.test.ts`
  - invalid local config fallback remains covered by one strict warning-and-fallback contract instead of duplicated tests: covered by `tests/unit/config/loader.test.ts`
- Edge cases covered:
  - sync replay with saved `features` no longer rematerializes unrelated settings like `mcp` or `ignore`
  - legacy `skills/engineering` replay installs only the picked descendant skill and preserves the normalized manual skill scope contract (`path: skills`, `as: skills`)
  - sync reinstall tests now assert exact pack contents and exact generated target files for saved subsets
  - manual markdown and skill staging keep exact file-set coverage after redundant suite removal
- Actions taken:
  - fixed `src/install/run-install.ts` to pass replay-scoped canonical data into pack materialization
  - removed redundant `tests/unit/install/manual-install-scope.test.ts`
  - extracted shared install test file-list helpers into `tests/helpers/install-test-helpers.ts`
  - split oversized markdown install integration coverage into `tests/integration/install-manual-as.markdown.integration.test.ts` and `tests/integration/install-manual-as.markdown-merge.integration.test.ts`, with shared fixtures in `tests/helpers/install-markdown-fixture.ts`
  - removed dead `mockSyncInstalledPacks` scaffolding from `tests/unit/install/run-install.test.ts`
  - tightened `tests/integration/install-sync.integration.test.ts` and `tests/unit/config/loader.test.ts`
- Sequential verification:
  - `pnpm vitest run tests/unit/install/manual-install-scope.markdown.test.ts`
  - `pnpm vitest run tests/unit/install/manual-install-scope.skills.test.ts`
  - `pnpm vitest run tests/unit/install/run-install.test.ts`
  - `pnpm vitest run tests/integration/install-sync.integration.test.ts`
  - `pnpm vitest run tests/unit/config/loader.test.ts`
  - `pnpm vitest run tests/unit/config/schema.test.ts`
  - `pnpm vitest run tests/unit/core/linter.test.ts`
  - `pnpm vitest run tests/unit/core/matrix.test.ts`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm vitest run tests/integration/install-manual-as.markdown.integration.test.ts tests/integration/install-manual-as.markdown-merge.integration.test.ts`
  - `pnpm test`
- Result: all checks passed; final full suite green at 144 files / 1585 tests.
- [x] Add failing tests for Junie commands projection/import (`.junie/commands/**` <-> `.agentsmesh/commands/**`)
- [x] Add failing tests for Junie agents projection/import (`.junie/agents/**` <-> `.agentsmesh/agents/**`)
- [x] Add/extend strict target contract assertions for Junie generated/imported file sets
- [x] Implement Junie generator support for compatibility mirrors, commands, and agents
- [x] Implement Junie importer support for commands and agents (plus mirrors where applicable)
- [x] Update support matrix and Junie lint messaging to match implemented behavior
- [x] Run targeted RED->GREEN cycles for new Junie unit/e2e/integration/roundtrip coverage
- [x] Run `pnpm build`, `pnpm test`, and `pnpm lint` and resolve regressions
- [x] Run post-feature QA checklist and add QA report notes

## Review

- QA: Added strict Junie contract coverage (unit + roundtrip + e2e contract matrix + import/generate capability assertions).
- Behavior: Junie now projects/imports `.junie/commands/**` and `.junie/agents/**`, emits compatibility mirrors (`AGENTS.md`, `.junie/guidelines.md`, `.junie/ci-guidelines.md`), and imports `.junie/rules/*.md`.
- Verification: `pnpm test:e2e`, `pnpm test`, and `pnpm lint` pass.

# Windsurf structure alignment (project-level advanced)

- [x] Add failing tests for Windsurf `.windsurf/hooks.json` + `.windsurf/mcp_config.example.json` generate/import behavior
- [x] Implement Windsurf generator support for hooks + MCP example config
- [x] Implement Windsurf importer support for `.windsurf/hooks.json` and MCP config (`mcp_config.example.json` / `mcp_config.json`)
- [x] Update Windsurf support matrix/linter and strict target contracts
- [x] Run targeted unit/integration/e2e/roundtrip verification and fix regressions
- [x] Run post-feature QA checklist and append review notes

## Review (Windsurf alignment)

- Behavior: Windsurf now generates `.windsurf/hooks.json` and `.windsurf/mcp_config.example.json`, and imports hooks/MCP back into `.agentsmesh/hooks.yaml` and `.agentsmesh/mcp.json`.
- Contract: Updated strict target contracts to include Windsurf hooks + MCP artifacts and canonical imported outputs.
- Coverage: Added unit tests (generator/importer), e2e capability assertions, fixture coverage, research suite checks, and roundtrip exact-path assertions.
- Verification: `pnpm vitest tests/unit/targets/windsurf/generator.test.ts tests/unit/targets/windsurf/importer.test.ts tests/agents-folder-structure-research.test.ts tests/import-generate-roundtrip.test.ts`; `pnpm build`; `pnpm vitest run --config vitest.e2e.config.ts tests/e2e/generate-capabilities.e2e.test.ts tests/e2e/import-capabilities.e2e.test.ts tests/e2e/target-contract-matrix.e2e.test.ts`; `pnpm vitest tests/unit/core/matrix.test.ts tests/unit/core/linter.test.ts`.

# Cursor content-format alignment (excluding environment/sandbox)

- [x] Add strict Cursor e2e content-format contract assertions for all generated Cursor artifacts except `.cursor/environment.json` and `.cursor/sandbox.json`
- [x] Adjust Cursor generator output format if needed to match `docs/agent-structures/cursor-project-level-advanced.md`
- [x] Run `pnpm build` + targeted e2e suites and resolve regressions

## Review (Cursor content-format alignment)

- Behavior: Cursor hooks generation now emits `.cursor/hooks.json` with a top-level `version: 1` plus canonical hook projections under `hooks`.
- Contract: Added a dedicated e2e test asserting content-format expectations across all generated Cursor artifacts except `environment/sandbox`: `AGENTS.md`, `.cursor/rules/*.mdc`, `.cursor/commands/*.md`, `.cursor/agents/*.md`, `.cursor/skills/**`, `.cursor/hooks.json`, `.cursor/mcp.json`, `.cursorignore`.
- Verification: `pnpm build`; `pnpm vitest run tests/unit/targets/cursor/generator.test.ts`; `pnpm vitest run --config vitest.e2e.config.ts tests/e2e/generate-capabilities.e2e.test.ts tests/e2e/target-contract-matrix.e2e.test.ts`.

# Senior architect library review

- [x] Review package surface, runtime boundaries, and published contract
- [x] Inspect core orchestration flow (`config` -> canonical -> engine -> targets -> import/install)
- [x] Identify architectural risks, scaling limits, and maintainability hotspots with code references
- [x] Summarize concrete improvement recommendations and add review notes

## Review (Senior architect library review)

- Verification:
  - `pnpm build`
  - `pnpm test`
  - `pnpm lint`
  - `pnpm typecheck`
- Findings:
  - `runLint()` skips command/MCP/permissions/hooks diagnostics whenever `rules` is disabled because the whole per-target loop is gated on `hasRules`; this is a real validation gap in `src/core/linter.ts`.
  - `loadConfigFromDir()` intentionally drops invalid `agentsmesh.local.yaml` merges silently and keeps the project config, which avoids hard failures but hides operator mistakes in team environments.
  - Target metadata is split across side-effect registration, dedicated import maps, dedicated lint maps, schema target enums, and matrix data, so adding or changing a target requires synchronized edits in multiple places.
  - The package is currently shipped as a CLI artifact only (`dist/cli.js` as `main`/`exports`), despite the project positioning itself as a library; this limits embedding and makes the CLI the only stable integration seam.
  - Import writes canonical files directly during traversal without a staging/commit phase, so a partially failing import can leave `.agentsmesh/` in a mixed state.
- Maintainability notes:
  - Several files exceed the project’s own 200-line target, especially target-specific importer/generator modules and install orchestration (`windsurf/importer.ts`, `junie/importer.ts`, `gemini-cli/generator.ts`, `codex-cli/generator.ts`, `run-install.ts`).

# Architect review follow-up implementation

- [x] Add failing tests for `lint` when `rules` is disabled but other features are enabled
- [x] Add failing tests for visible handling of invalid `agentsmesh.local.yaml`
- [x] Implement the `lint` feature-gating fix
- [x] Implement warning/visibility for invalid local config fallback
- [x] Consolidate target metadata into a shared source of truth and update schema/import/matrix/lint wiring
- [x] Run sequential targeted verification after each change
- [x] Run broader verification and post-feature QA, then append review notes

## Review (Architect review follow-up implementation)

- Behavior:
  - `runLint()` now applies rule checks only when `rules` is enabled, while command/MCP/permission/hook linting runs independently by feature flag.
  - Invalid `agentsmesh.local.yaml` merges now emit a warning before falling back to the project config.
  - Target ids, import empty-state messages, rule linter wiring, and compatibility capabilities are centralized in `src/targets/target-catalog.ts`, with schema/import/matrix/lint reading from that shared catalog.
- Targeted sequential verification:
  - `pnpm vitest run tests/unit/core/linter.test.ts`
  - `pnpm vitest run tests/unit/config/loader.test.ts`
  - `pnpm vitest run tests/unit/config/schema.test.ts`
  - `pnpm vitest run tests/unit/cli/commands/import.test.ts`
  - `pnpm vitest run tests/unit/core/matrix.test.ts`
  - `pnpm vitest run tests/unit/core/linter.test.ts`
  - `pnpm vitest run tests/unit/config/loader.test.ts`
- QA Report — Architect review follow-up implementation
- Acceptance criteria:
  - non-rule lint diagnostics still run when `rules` is disabled: covered by `tests/unit/core/linter.test.ts`
  - invalid local override fallback is visible to operators: covered by `tests/unit/config/loader.test.ts`
  - schema, import, and matrix target metadata read from one shared catalog: covered by `tests/unit/config/schema.test.ts`, `tests/unit/cli/commands/import.test.ts`, and `tests/unit/core/matrix.test.ts`
- Edge cases covered:
  - simultaneous command/MCP/permission/hook warnings with zero rules enabled
  - invalid local target list in `agentsmesh.local.yaml` falls back cleanly while warning
  - unknown import target validation still reports the supported target set from the shared catalog
  - matrix default target ordering remains aligned with schema defaults
- Broader verification:
  - `pnpm build`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

# Install sync legacy nested-skill replay

- [x] Add failing regression test for legacy `installs.yaml` entries that point at a nested skill folder but pick a descendant skill
- [x] Implement legacy replay recovery for manual `--as skills` sync without changing normal install semantics
- [x] Run sequential targeted verification for install sync/manual skill coverage
- [x] Run broader verification, update QA notes, and capture the lesson

## Review (Install sync legacy nested-skill replay)

- Behavior:
  - legacy `install --sync` entries that saved a path like `skills/engineering` but picked a descendant nested skill like `release-manager` now recover that descendant skill instead of failing with `No resources match...`.
  - normal manual `--as skills` installs still treat a directory with its own `SKILL.md` as a single skill unless replayed picks explicitly target descendant skills.
- QA Report — Install sync legacy nested-skill replay
- Acceptance criteria:
  - legacy nested-skill manifest replay restores the requested descendant skill: covered by `tests/integration/install-sync.integration.test.ts`
  - manual skill staging can recover descendant picks from an umbrella skill container during replay: covered by `tests/unit/install/manual-install-scope.skills.test.ts`
  - regular manual skill install and install replay behavior remain unchanged: covered by `tests/unit/install/run-install.test.ts`, `tests/integration/install-manual-as.skills.integration.test.ts`, and `tests/e2e/install.e2e.test.ts`
- Edge cases covered:
  - container skill with its own `SKILL.md` plus nested child skills
  - replay pick requests one descendant skill and excludes sibling nested skills
  - descendant skill supporting files are preserved during recovery
  - non-replay installs for standalone skill folders still stage the container skill normally
- Sequential verification:
  - `pnpm vitest run tests/unit/install/manual-install-scope.skills.test.ts`
  - `pnpm vitest run tests/integration/install-sync.integration.test.ts`
  - `pnpm vitest run tests/unit/install/run-install.test.ts`
  - `pnpm vitest run tests/integration/install-manual-as.skills.integration.test.ts`
  - `pnpm build`
  - `pnpm vitest run --config vitest.e2e.config.ts tests/e2e/install.e2e.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

# Install test hardening and dead-code audit

- [x] Audit install-related tests and helpers for duplicate coverage, dead code, and weak assertions
- [x] Tighten affected tests to use exact path/count/content assertions where the expected output set is known
- [x] Remove or consolidate dead/duplicate test helpers and redundant cases without reducing behavioral coverage
- [x] Run sequential targeted verification for the hardened install suites
- [x] Run broader verification, complete post-feature QA, and append review notes

## Review (Install test hardening and dead-code audit)

- QA Report — Install test hardening and dead-code audit
- Acceptance criteria:
  - duplicate install coverage is consolidated so one authoritative suite owns each manual install flow: covered by `tests/integration/install-manual-as.markdown.integration.test.ts`, `tests/integration/install-manual-as.skills.integration.test.ts`, `tests/integration/install-sync.integration.test.ts`, `tests/unit/install/manual-install-scope.markdown.test.ts`, and `tests/unit/install/manual-install-scope.skills.test.ts`
  - install assertions are strict about exact generated trees, exact pack trees, and parsed manifest content where the output set is known: covered by the same integration/unit suites plus `tests/unit/install/run-install.test.ts`
  - shallow sync control-flow tests now prove skipped branches instead of only success/failure: covered by `tests/unit/install/run-install.test.ts`
- Duplicate/dead coverage removed:
  - deleted `tests/unit/install/manual-install-scope.test.ts`
  - deleted `tests/integration/install-manual-as.integration.test.ts`
  - deleted `tests/integration/install-manual-skills.integration.test.ts`
  - deleted `tests/integration/install-manual-commands.integration.test.ts`
  - deleted `tests/integration/install-manual-rules.integration.test.ts`
  - added shared helper `tests/helpers/install-test-helpers.ts` to replace repeated file-tree walkers and ad hoc manifest string checks
- Edge cases strengthened:
  - direct-source manual installs for markdown entities now assert exact persisted picks and generated outputs
  - manual skills tests now cover direct skill-directory sources with exact pack and manifest trees
  - command-folder flattening (`nested/test.md` -> `test.md`) is asserted in the markdown matrix instead of a duplicate standalone suite
  - upstream root-rule installs still preserve the project root rule while asserting the exact generated tree
  - sync replay now asserts exact restored pack trees, exact generated trees, and manifest normalization for legacy nested-skill entries
- Sequential verification:
  - `pnpm vitest run tests/unit/install/manual-install-scope.markdown.test.ts`
  - `pnpm vitest run tests/unit/install/manual-install-scope.skills.test.ts`
  - `pnpm vitest run tests/unit/install/run-install.test.ts`
  - `pnpm vitest run tests/integration/install-manual-as.markdown.integration.test.ts`
  - `pnpm vitest run tests/integration/install-manual-as.skills.integration.test.ts`
  - `pnpm vitest run tests/integration/install-sync.integration.test.ts`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - full suite passed after consolidation: 144 test files, 1585 tests
  - test count dropped from 1593 to 1585 because redundant suites were removed while unique behaviors were folded into stricter matrix coverage

# Live install sync replay regression

- [x] Reproduce `install --sync` against the current `.agentsmesh/installs.yaml` and identify the failing persisted entry shape
- [x] Add a regression test for the exact manifest shape before changing replay behavior
- [x] Implement the minimal replay/discovery fix so the current manifest syncs successfully
- [x] Run sequential targeted verification for the replay fix, then broader build/type/test gates
- [x] Run post-feature QA and append review notes

## Review (Live install sync replay regression)

- QA Report — Live install sync replay regression
- Reproduction:
  - the current workspace manifest failed on `joeking-ly-claude-skills-arsenal-skills`
  - persisted shape: `features: [skills]`, `pick.skills: [release-manager]`, `path: skills`, `as: skills`
  - upstream layout stores the selected skill under `skills/engineering/release-manager`, so replaying from `skills/` needed descendant-skill recovery instead of top-level collection staging
- Acceptance criteria:
  - replaying a nested picked skill from a skills collection root restores only the picked descendant skill: covered by `tests/unit/install/manual-install-scope.skills.test.ts`
  - sync replay for `path: skills` plus `pick.skills: [release-manager]` succeeds and materializes only that skill: covered by `tests/integration/install-sync.integration.test.ts`
  - the actual current workspace manifest no longer throws `No resources match the install path or implicit selection`: verified with `node dist/cli.js install --sync --dry-run --force`
- Fix:
  - generalized manual skill replay staging so preferred picked skill names are resolved across all descendant `SKILL.md` paths under a collection root, not only umbrella folders that themselves contain `SKILL.md`
  - implementation lives in `src/install/manual-install-scope.ts`
- Sequential verification:
  - `pnpm vitest run tests/unit/install/manual-install-scope.skills.test.ts`
  - `pnpm vitest run tests/integration/install-sync.integration.test.ts`
  - `pnpm build`
  - `node dist/cli.js install --sync --dry-run --force`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Result:
  - current live manifest replay passes in dry-run
  - full suite passed: 143 test files, 1583 tests
  - validation note: `install --sync --dry-run` still wrote pack state during the live check; I restored those workspace side effects afterward so the worktree returned to its pre-check pack state

# Commit Pending Changes
- [ ] Add untracked files (`src/install/skill-repo-filter.ts`, `tests/unit/core/artifact-path-map-packs.test.ts`)
- [ ] Run full test suite to verify everything is passing
- [ ] Commit all changes with a descriptive conventional commit message
