# Architecture alignment review

- [x] Compare the documented architecture in `docs/architecture/` with the current code-domain boundaries and critical flows
- [x] Inspect the highest-risk seams for boundary drift, orchestration leakage, and structural mismatches
- [x] Summarize concrete alignment findings, strengths, and low-risk remediation steps
- [x] Append review notes with evidence and residual risks

## Review (Architecture alignment review)

- Overall alignment:
  - the top-level source tree now matches the documented domain map closely: `src/config`, `src/canonical`, `src/core`, `src/install`, `src/targets`, and `src/utils` all have the subdomain structure described in `docs/architecture/overview.md`
  - the canonical-first runtime shape is real in code: CLI commands load config, load canonical state, then call target-agnostic core generation/import/lint logic, with target adapters under `src/targets/*`
  - target metadata centralization materially improved alignment: the built-in target catalog now drives ids, import/lint wiring, and most feature-generator dispatch
- Main misalignments:
  - `install` still depends upward on `cli` orchestration: `src/install/run/run-install.ts` imports and calls `runGenerate()` from `src/cli/commands/generate.ts`, which reverses the documented dependency direction where CLI coordinates domains rather than domains calling CLI
  - `install/core` also reaches into `install/run`: `src/install/core/install-discovery.ts` imports `resolveDiscoveredForInstall()` from `src/install/run/run-install-discovery.ts`, so the supposedly lower-level install subdomain depends on the orchestration layer
  - `core/reference` still contains a large amount of target-native path knowledge directly, via target constants and `switch` statements in `src/core/reference/map-targets.ts`, which conflicts with the documented rule that core should stay target-agnostic outside target metadata
  - `core/generate` still has a small amount of target-name branching and direct target helper imports in `src/core/generate/optional-features.ts` for Copilot hook assets and Gemini settings handling, so the core/targets seam is improved but not fully normalized
  - the target metadata contract is only partially normalized: `src/targets/catalog/builtin-targets.ts` still branches on target ids for support and generator routing, and `src/targets/catalog/target.interface.ts` still encodes target-specific method variants like `generateWorkflows` and `generateSettings`
  - `config/remote` still reaches into `install/pack` for cache cleanup (`src/config/remote/remote-fetcher.ts`), which the architecture docs already call out as acceptable-but-not-ideal cross-domain coupling
  - several high-churn files still exceed the repo’s 200-line limit, especially target importers/generators plus `src/install/run/run-install.ts`, which weakens the intended “small subdomain modules” maintainability goal even though the folder structure now aligns
- Lowest-risk remediation path:
  - extract a domain-level post-install regenerate callback or shared `generateAndPersistArtifacts()` service so `install` no longer imports CLI code
  - move `run-install-discovery.ts` logic into `install/core` or rename/rehome it so `install/run` becomes a pure orchestration layer
  - continue moving target path resolution into target descriptors so `core/reference` consumes metadata rather than importing per-target constants and path builders
  - replace `generateWorkflows` / `generateSettings` with a normalized feature-generator map on built-in target descriptors, then make `resolveTargetFeatureGenerator()` data-driven
  - extract cache helpers into a neutral cache utility or `config/cache` subdomain so remote fetching does not depend on `install/pack`
  - keep splitting the remaining oversized target/import/install files by feature boundary rather than by arbitrary line count
- Verification notes:
  - this was an analysis-only review against the current source tree and the new `docs/architecture/` set
  - no tests were added or changed

# Architecture documentation set

- [x] Create `docs/architecture/` overview, container view, flow docs, and domain boundary docs based on the current codebase
- [x] Add ADRs in the existing `docs/adr/` folder for the core architectural decisions not yet documented
- [x] Cross-link the new docs so the architecture set is navigable and consistent with the current module structure
- [x] Run a documentation QA pass and append review notes

## Review (Architecture documentation set)

- Changes implemented:
  - added `docs/architecture/overview.md` as the architecture entrypoint and index
  - added `docs/architecture/containers.md` with a C4-lite code-domain view
  - added critical flow docs for generate, import, install, and watch under `docs/architecture/flows/`
  - added domain boundary docs for `cli`, `config`, `canonical`, `core`, `install`, `targets`, and `utils` under `docs/architecture/domains/`
  - added four ADRs in the existing `docs/adr/` folder for canonical source of truth, centralized target descriptors, feature projection policy, and the watch/lock contract
  - narrowed the root `docs` ignore policy so `docs/architecture/**` and `docs/adr/**` are now trackable without opening the rest of the ignored docs tree
  - captured the ignore-policy miss in `tasks/lessons.md` so future doc additions verify git visibility first
- Tests added:
  - none; this was a documentation-only change
- Verification:
  - `find docs/architecture docs/adr -type f -name '*.md' -print0 | xargs -0 wc -l`
  - `git check-ignore -v docs/architecture/overview.md docs/adr/adr-canonical-source-of-truth.md`
  - `git diff --check -- .gitignore tasks/lessons.md tasks/todo.md docs/architecture docs/adr`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- QA Report — Architecture documentation set
- Acceptance criteria:
  - architecture docs exist for overview, container view, flows, and domain boundaries: covered by the new `docs/architecture/` tree
  - ADRs exist for the main architectural decisions that were previously implicit in code: covered by the new `docs/adr/adr-*.md` files plus the existing pack ADR
  - documentation is navigable and internally linked: covered by `docs/architecture/overview.md` links to all new sections and ADRs
  - the new docs are committable and not stranded behind the repo-level `/docs` ignore rule: covered by the narrowed `.gitignore` entries and the successful `git check-ignore` verification
- Edge cases checked:
  - all new files remain below the repo's 200-line file limit
  - no whitespace or patch-format issues were introduced
  - repo-wide lint, typecheck, and full test suite still pass after the docs plus ignore-policy updates
- Gaps identified:
  - no automated markdown link checker is configured in the repo today, so link validity was reviewed manually

# Remaining source-tree reorganization

- [x] Confirm existing tests cover the remaining main folders that still lack subdomain structure
- [x] Split the remaining top-heavy `src` folders into small subdomain folders with no behavior change
- [x] Update imports across source and tests
- [x] Run targeted verification for the moved domains, then `pnpm lint`, `pnpm typecheck`, and `pnpm test`
- [x] Run post-feature QA and append review notes

## Review (Remaining source-tree reorganization)

- Changes implemented:
  - split `src/config` into `core/`, `remote/`, and `resolve/`
  - split `src/utils` into `filesystem/`, `text/`, `output/`, and `crypto/`
  - split the shared-root part of `src/targets` into `catalog/`, `import/`, and `projection/`
  - preserved existing per-target folders and the existing `src/cli/commands/` subdomain layout, since those were already structured
  - updated imports across source and tests so the internal module graph follows the new folder boundaries without changing behavior
- Tests added:
  - none; existing config/utils/targets/import/generate/watch coverage already exercised the moved surfaces, so adding duplicate tests was unnecessary
- Verification:
  - `pnpm vitest run tests/unit/config tests/unit/utils tests/unit/targets tests/integration/import.integration.test.ts tests/integration/generate.integration.test.ts tests/import-generate-roundtrip.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- QA Report — Remaining source-tree reorganization
- Acceptance criteria:
  - every remaining top-level `src` domain now has meaningful subdomain grouping: covered by the structural changes in `config/`, `utils/`, and `targets/`
  - config loading, remote fetching, resolver behavior, and lock handling still work after the move: covered by `tests/unit/config/*`, `tests/integration/import.integration.test.ts`, and `tests/integration/generate.integration.test.ts`
  - utility consumers still resolve filesystem, markdown, hash, glob, and logger helpers correctly after the move: covered by `tests/unit/utils/*` and the passing full suite
  - target shared metadata/import/projection behavior still works after the move: covered by `tests/unit/targets/*`, `tests/import-generate-roundtrip.test.ts`, and the passing full suite
- Edge cases checked:
  - remote config fetchers still resolve GitHub/Git/GitLab sources after being moved under `config/remote/`
  - target importers still find shared import/projection helpers from their per-target folders
  - watcher behavior remained stable under the full suite after the wider import-path churn
- Gaps identified:
  - none

# Install + canonical folder reorganization

- [x] Confirm existing tests cover the install and canonical domains being reorganized
- [x] Split `src/install` and `src/canonical` top-level files into smaller domain subfolders with no behavior change
- [x] Update imports across source and tests
- [x] Run targeted verification for moved domains, then `pnpm lint`, `pnpm typecheck`, and `pnpm test`
- [x] Run post-feature QA and append review notes

## Review (Install + canonical folder reorganization)

- Changes implemented:
  - split `src/canonical` into `features/`, `extends/`, and `load/` so parsers, extend resolution, and canonical loading are no longer mixed in one folder
  - split `src/install` into `core/`, `manual/`, `native/`, `pack/`, `source/`, and `run/` so install flow helpers, source parsing/fetching, pack persistence, native/manual staging, and top-level orchestration are separated
  - updated imports across source and tests without changing public behavior or install/canonical contracts
  - hardened `src/cli/commands/watch.ts` again by waiting for chokidar readiness before the initial generate and normalizing watched paths for ignore checks
- Tests added:
  - none; the existing install/canonical/watch suites already covered the moved domains and the watch regression path, so adding duplicate tests was unnecessary
- Verification:
  - `pnpm vitest run tests/unit/install tests/unit/canonical tests/integration/install.integration.test.ts tests/integration/install-pack.integration.test.ts tests/integration/install-native-target.integration.test.ts tests/integration/install-sync.integration.test.ts tests/integration/install-manual-multi-path.integration.test.ts tests/integration/extends.integration.test.ts tests/integration/extends-native.integration.test.ts`
  - `pnpm vitest run tests/unit/cli/commands/watch.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- QA Report — Install + canonical folder reorganization
- Acceptance criteria:
  - install and canonical files are grouped into smaller, human-scalable folders without changing behavior: covered by the targeted install/canonical suite and the passing full `pnpm test` run
  - import, extend, pack, manual install, native install, and canonical parsing/loading still resolve through the new paths: covered by the targeted install/canonical unit and integration suites listed above
  - watch mode remains stable after the structural move and does not miss first edits or self-trigger on startup churn: covered by `tests/unit/cli/commands/watch.test.ts` and verified again in the passing full suite
- Edge cases checked:
  - native install scoping still works across the full target matrix after moving native helpers
  - manual install scope, pack read/write/merge, and sync replay still work after moving install orchestration helpers
  - canonical extends, pack loading, and slice loading still compose correctly after moving feature/load modules
  - full-suite watch timing remains stable when startup generate and lock writes occur under aggregate test load
- Gaps identified:
  - none

# Core folder reorganization

- [x] Confirm existing tests cover the core domains being reorganized
- [x] Split `src/core` top-level files into smaller domain subfolders with no behavior change
- [x] Update imports across source and tests
- [x] Run targeted verification for moved domains, then `pnpm lint`, `pnpm typecheck`, and `pnpm test`
- [x] Run post-feature QA and append review notes

## Review (Core folder reorganization)

- Changes implemented:
  - split `src/core` into smaller domain folders: `generate/`, `reference/`, `lint/`, and `matrix/`
  - kept behavior stable by moving existing modules with minimal logic changes and updating imports across source and tests
  - hardened `src/cli/commands/watch.ts` ignore handling so self-generated `.agentsmesh/.lock` writes do not retrigger through parent directory watcher events
- Tests added:
  - none; existing coverage already exercised the moved domains and the watch behavior, so adding duplicate tests was unnecessary
- Verification:
  - `pnpm vitest run tests/unit/core/engine.test.ts tests/unit/core/matrix.test.ts tests/unit/core/reference-map.test.ts tests/unit/core/reference-rewriter.test.ts tests/unit/core/import-reference-rewriter.test.ts tests/unit/core/link-rebaser.test.ts tests/unit/core/link-rebaser-edge-cases.test.ts tests/unit/core/linter.test.ts tests/unit/cli/commands/import.test.ts`
  - `pnpm vitest run tests/unit/cli/commands/watch.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- QA Report — Core folder reorganization
- Acceptance criteria:
  - core files are grouped into smaller, human-scalable folders without changing public behavior: covered by the targeted core-domain unit suite plus the passing full `pnpm test` run
  - generate/reference/lint/matrix imports remain correct after the move: covered by `tests/unit/core/engine.test.ts`, `tests/unit/core/matrix.test.ts`, `tests/unit/core/reference-map.test.ts`, `tests/unit/core/reference-rewriter.test.ts`, `tests/unit/core/import-reference-rewriter.test.ts`, and `tests/unit/core/linter.test.ts`
  - watch mode does not loop on its own lock writes after the reorganization: covered by `tests/unit/cli/commands/watch.test.ts` and verified again inside the full suite
- Edge cases checked:
  - reference rewriting still resolves canonical, generated, and pack-origin paths after the path changes
  - lint helpers still route command, hook, permission, and MCP validation through the moved modules
  - full-suite watcher timing remains stable when `.agentsmesh` emits parent-directory events during lock writes
- Gaps identified:
  - none

# Target architecture refactor

- [x] Add failing tests for unified built-in target metadata and built-in registry fallback
- [x] Refactor target metadata into a single built-in target source used by registry, catalog, engine, matrix, and reference-map helpers
- [x] Remove engine side-effect target registration and move target-specific feature routing behind target helpers
- [x] Run targeted verification for the refactor surface, then broader required tests
- [x] Run post-feature QA and append review notes

## Review (Target architecture refactor)

- Changes implemented:
  - added `src/targets/builtin-targets.ts` as the single built-in target descriptor source for ids, capabilities, import messaging, lint hooks, skill dirs, and conversion-aware feature routing
  - rewired `src/targets/registry.ts` and `src/targets/target-catalog.ts` to derive built-ins from that descriptor source instead of side-effect registration plus a separate static catalog
  - removed engine-side target registration imports and routed feature generation through `resolveTargetFeatureGenerator(...)`
  - moved effective support-level calculation into shared target helpers and reused built-in metadata in reference-map root/skill directory lookup
  - exported target generator objects directly from each target `index.ts` module so composition is explicit
- Tests added:
  - `tests/unit/targets/builtin-targets.test.ts`
  - extended `tests/unit/targets/registry.test.ts` with built-in registry fallback coverage
- Verification:
  - `pnpm vitest run tests/unit/targets/builtin-targets.test.ts tests/unit/targets/registry.test.ts`
  - `pnpm vitest run tests/unit/core/engine.test.ts tests/unit/core/matrix.test.ts tests/unit/core/reference-map.test.ts tests/unit/core/linter.test.ts tests/unit/cli/commands/import.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- QA Report — Target architecture refactor
- Acceptance criteria:
  - unified built-in metadata is the source of truth for target ids and catalog wiring: covered by `tests/unit/targets/builtin-targets.test.ts`, `tests/unit/targets/registry.test.ts`, and `tests/unit/cli/commands/import.test.ts`
  - engine no longer depends on side-effect target registration and still emits the same outputs: covered by `tests/unit/core/engine.test.ts` and the full `tests/integration/generate.integration.test.ts`
  - effective capability/projection behavior still matches config conversions: covered by `tests/unit/targets/builtin-targets.test.ts` and `tests/unit/core/matrix.test.ts`
  - reference rewriting/path mapping still resolves root, command, agent, and skill outputs correctly: covered by `tests/unit/core/reference-map.test.ts` and `tests/unit/core/generate-reference-rewrite.test.ts`
- Edge cases checked:
  - built-in targets resolve without manual registration
  - codex command projection disables cleanly when `commands_to_skills.codex-cli` is `false`
  - windsurf agent projection disables cleanly when `agents_to_skills.windsurf` is `false`
  - import/lint/generate continue to honor the same built-in target list after the refactor
- Gaps identified:
  - none

# Architecture review — library structural analysis

- [x] Map the current runtime architecture across canonical loading, core engine, config resolution, CLI orchestration, and target adapters
- [x] Inspect structural hotspots in module boundaries, file sizes, target registration, and test organization
- [x] Identify the highest-impact architectural gaps with concrete evidence and low-risk remediation options
- [x] Append review notes with recommendations and residual verification gaps

## Review (Architecture review — library structural analysis)

- Architecture shape:
  - canonical loading and merge flow is coherent: config loader -> extends resolver -> canonical merge -> engine generation -> CLI persistence/reporting
  - the main structural risk is not missing layers, but duplicated target knowledge and target-specific branching spread across core, targets, and CLI support code
- Highest-impact gaps:
  - target metadata is split between side-effect registry registration and `TARGET_CATALOG`, which increases drift risk for generation/import/lint/matrix/schema updates
  - core orchestration contains target-name conditionals for conversion and special output families, so the engine owns adapter quirks that should live in target definitions
  - target path and capability knowledge is duplicated again in reference-map/matrix helpers, making new-target work fan out across many files
  - install and generate orchestration remain monolithic enough that policy, persistence, and user interaction changes are higher-risk than they need to be
  - several production files exceed the repo's 200-line limit, concentrated in adapter/import/install paths, which is a maintainability warning more than an immediate bug
- Lowest-risk remediation path:
  - introduce one canonical built-in target descriptor per target and derive registry, import/lint catalog, target ids, and capability matrix from it
  - move conversion and optional-output decisions behind per-target feature handlers/metadata so `core/engine.ts` stops branching on target ids
  - extract shared post-generate finalization and install pipeline phases without changing behavior
  - split the largest adapter/import/install modules by feature to reduce blast radius for future changes
- Verification notes:
  - review based on source inspection of `src/` and test layout; no functional code changes were made beyond documenting this review in `tasks/todo.md`
  - no test suite run was needed for this analysis-only pass

# Packs Feature — Local Materialized Installs

# Release 0.2.3 prep

- [x] Audit release prerequisites for `0.2.3` across tests, workflows, community files, changesets, changelog, package contents, README badges, and generated targets
- [x] Apply any fixes required to make the next patch release publish-ready
- [x] Run final release verification gates and append a QA/release-readiness review

## Review (Release 0.2.3 prep)

- Release Readiness — agentsmesh v0.2.3
- Phase status:
  - Test suite: OK — `pnpm test` passed (`146` test files, `1639` tests)
  - Watch timing: OK — `vitest.config.ts` keeps `testTimeout: 15_000` and `hookTimeout: 10_000`; watch test waits still meet the documented CI-safe minimums
  - CI workflows: OK — `.github/workflows/ci.yml` and `.github/workflows/publish.yml` match the required Node 22 / pnpm 10 / changesets trusted-publishing flow
  - Community files: OK — `SECURITY.md`, `CONTRIBUTING.md`, issue templates, and PR template are present and meet the release checklist
  - Changesets: OK — `.changeset/config.json` is correct and the pending patch changeset was rewritten to a user-facing `0.2.3` summary
  - CHANGELOG: OK — checked-in changelog is current through `0.2.2`; the `0.2.3` entry will be generated by the changesets version PR from the updated pending changeset
  - Package contents: OK — `pnpm pack --dry-run` contained only `CHANGELOG.md`, `dist/cli.js`, `dist/cli.js.map`, `LICENSE`, `package.json`, and `README.md`
  - README badges: OK — the four required release badges are present immediately after the `# AgentsMesh` heading
  - Final gate: OK — `pnpm typecheck`, `pnpm lint`, and `pnpm test:coverage` passed; coverage finished at `92.36%` statements, `84.36%` branches, `95.64%` functions, `94.77%` lines
  - Generated to targets: OK — `node dist/cli.js generate` reported `Nothing changed. (939 unchanged)`
- Fixes applied:
  - updated `.changeset/codex-instructions-projection.md` so the pending patch release accurately describes the final Codex behavior: additional rules project to `.codex/instructions/` and `AGENTS.md` remains the sole root instruction file
- Remaining actions before publish:
  - ensure GitHub Actions is allowed to create and approve pull requests in repo settings
  - ensure npm trusted publisher settings point at this repository and `.github/workflows/publish.yml`
  - ensure `CODECOV_TOKEN` is configured in GitHub secrets
  - push the pending changes to `master` so `changesets/action` opens the `chore: version packages` PR
  - review and merge the version PR so it bumps `package.json`/`CHANGELOG.md` to `0.2.3` and publishes automatically

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

# Root instruction self-description paragraph

- [x] Add failing tests for generated main instruction files to append the AgentsMesh paragraph once

# Codex instructions folder projection

- [x] Add failing tests for Codex rule generation under `.codex/instructions/**` plus AGENTS.md rule index links/scope text
- [x] Add failing tests for Codex import/native-install scope against `.codex/instructions/**`
- [x] Update codex-cli generator/path helpers so canonical rules emit to `.codex/instructions/**`
- [x] Amend generated `AGENTS.md` to link each projected canonical rule and describe when it applies
- [x] Update Codex importer/reference/install contract coverage for the new layout
- [x] Run targeted verification, append review notes, and complete post-feature QA

## Review (Codex instructions folder projection)

- QA Report — Codex instructions folder projection
- Acceptance criteria:
  - additional non-root Codex rules are mirrored as markdown under `.codex/instructions/*.md`, while root guidance stays only in `AGENTS.md`: covered by `tests/unit/targets/codex-cli/generator.test.ts`, `tests/e2e/codex-format-roundtrip.e2e.test.ts`, and `tests/e2e/target-contract-matrix.e2e.test.ts`
  - generated `AGENTS.md` keeps root instructions and links each additional mirrored rule with scope/usage text: covered by `tests/unit/targets/codex-cli/generator.test.ts`, `tests/e2e/generate-anatomy.e2e.test.ts`, and `tests/integration/generate-reference-rewrite.integration.test.ts`
  - Codex import and native install discovery understand `.codex/instructions/**` and round-trip back to canonical rules: covered by `tests/unit/targets/codex-cli/importer.test.ts`, `tests/unit/install/native-install-scope.codex.test.ts`, `tests/e2e/codex-format-roundtrip.e2e.test.ts`, and `tests/e2e/target-contract-matrix.e2e.test.ts`
  - shared `AGENTS.md` overlap no longer blocks multi-target generation when Codex is enabled with Cline/Windsurf: covered by `tests/unit/core/engine.test.ts` and `tests/import-generate-roundtrip.test.ts`
- Edge cases:
  - root-only Codex generation emits only `AGENTS.md` and does not append an unnecessary rule index: covered by `tests/unit/targets/codex-cli/generator.test.ts`
  - advisory rules with globs, broad `**/*` scope, and override metadata all project to stable slug-based mirror paths: covered by `tests/unit/targets/codex-cli/codex-rule-paths.test.ts`
  - execution rules still emit `.codex/rules/*.rules` while also producing mirrored markdown metadata for import/indexing: covered by `tests/unit/targets/codex-cli/generator.test.ts`
  - imported root rules strip generated Codex rule-index sections and shared AgentsMesh root paragraphs so canonical `_root.md` stays clean: covered by `tests/unit/targets/codex-cli/importer.test.ts` and `tests/e2e/target-contract-matrix.e2e.test.ts`
- Actions taken:
  - added `src/targets/codex-cli/instruction-mirror.ts` to centralize mirror-path generation, mirror serialization, AGENTS index generation, and index stripping
  - updated Codex generation/import/reference/overlap logic so `AGENTS.md` remains the sole root file and `.codex/instructions/*.md` carries only additional rules, plus shared imported-root cleanup in `src/targets/import-metadata.ts`
  - expanded Codex unit, integration, and e2e contract coverage for the new layout
- Verification:
  - `pnpm build`
  - `pnpm lint`
  - `pnpm test`
- Result:
  - full suite passed: 146 test files, 1639 tests
- [x] Implement shared paragraph injection with dedupe for primary root instruction outputs
- [x] Run targeted verification and append review notes

## Review (Root instruction self-description paragraph)

- QA Report — Root instruction self-description paragraph
- Acceptance criteria:
  - generated primary root instruction files append the AgentsMesh library paragraph automatically: covered by `tests/unit/targets/claude-code/generator.test.ts`, `tests/unit/targets/continue/generator.test.ts`, `tests/unit/targets/cursor/generator.test.ts`, `tests/unit/targets/copilot/generator.test.ts`, `tests/unit/targets/junie/generator.test.ts`, `tests/unit/targets/gemini-cli/generator.test.ts`, `tests/unit/targets/cline/generator.test.ts`, `tests/unit/targets/codex-cli/generator.test.ts`, and `tests/unit/targets/windsurf/generator.test.ts`
  - generation does not duplicate the paragraph when the root rule already contains it: covered by `tests/unit/targets/claude-code/generator.test.ts`
  - shared `AGENTS.md` compatibility outputs no longer conflict when multiple targets generate together: covered by `tests/unit/core/engine.test.ts`, `tests/import-generate-roundtrip.test.ts`, and `tests/integration/generate-reference-rewrite.integration.test.ts`
- Edge cases covered:
  - empty root bodies still emit the paragraph for primary root files: covered by `tests/unit/targets/copilot/generator.test.ts`, `tests/unit/targets/gemini-cli/generator.test.ts`, and `tests/unit/targets/cline/generator.test.ts`
  - existing generated files with the paragraph are treated as unchanged by diff/generate status logic: covered by `tests/unit/core/engine.test.ts`, `tests/unit/core/generate-reference-rewrite.test.ts`, and `tests/unit/cli/commands/diff.test.ts`
  - compatibility mirrors for Cursor and Gemini yield cleanly during overlapping `AGENTS.md` generation instead of hard-failing: covered by `tests/import-generate-roundtrip.test.ts` and `tests/integration/generate-reference-rewrite.integration.test.ts`
- Verification:
  - `pnpm vitest run tests/unit/targets/claude-code/generator.test.ts tests/unit/targets/cursor/generator.test.ts tests/unit/targets/copilot/generator.test.ts tests/unit/targets/junie/generator.test.ts tests/unit/targets/gemini-cli/generator.test.ts tests/unit/targets/cline/generator.test.ts tests/unit/targets/codex-cli/generator.test.ts tests/unit/targets/windsurf/generator.test.ts`
  - `pnpm vitest run tests/unit/core/engine.test.ts tests/unit/core/generate-reference-rewrite.test.ts tests/import-generate-roundtrip.test.ts tests/integration/import.integration.test.ts`
  - `pnpm build && pnpm vitest run tests/integration/generate-reference-rewrite.integration.test.ts`
  - `pnpm test`
  - `pnpm lint`

# Root instruction centralization refactor

- [x] Add failing tests for engine-level primary root instruction decoration metadata
- [x] Centralize root instruction decoration in the engine/target registry and remove per-target duplication
- [x] Run targeted verification, full verification, and append review notes

## Review (Root instruction centralization refactor)

- QA Report — Root instruction centralization refactor
- Acceptance criteria:
  - primary root instruction decoration is owned by shared engine/target metadata rather than target-local generator code: covered by `tests/unit/core/engine.test.ts`
  - generators emit their native/plain root content and the engine decorates only the registered primary root artifact: covered by `tests/unit/targets/claude-code/generator.test.ts`, `tests/unit/targets/continue/generator.test.ts`, `tests/unit/targets/cursor/generator.test.ts`, `tests/unit/targets/copilot/generator.test.ts`, `tests/unit/targets/gemini-cli/generator.test.ts`, `tests/unit/targets/cline/generator.test.ts`, `tests/unit/targets/codex-cli/generator.test.ts`, `tests/unit/targets/junie/generator.test.ts`, and `tests/unit/targets/windsurf/generator.test.ts`
  - overlapping compatibility mirrors still resolve cleanly after engine-level decoration: covered by `tests/import-generate-roundtrip.test.ts`, `tests/unit/cli/commands/diff.test.ts`, `tests/unit/core/generate-reference-rewrite.test.ts`, and `tests/integration/generate-reference-rewrite.integration.test.ts`
- Edge cases covered:
  - Continue and Cursor root files are decorated through engine metadata rather than per-target special casing: covered by `tests/unit/core/engine.test.ts`
  - Cursor compatibility `AGENTS.md` remains plain while `.cursor/rules/general.mdc` is decorated as the primary root artifact: covered by `tests/unit/core/engine.test.ts`
  - existing decorated root outputs are reported as `unchanged` when on-disk content already matches the centralized engine output: covered by `tests/unit/core/engine.test.ts`
- Implementation notes:
  - added `primaryRootInstructionPath` to target registration in `src/targets/target.interface.ts`
  - added shared engine pass in `src/core/root-instruction-decorator.ts`
  - moved root decoration out of target generators and into `src/core/engine.ts`
  - fixed Cursor metadata to reuse exported `CURSOR_RULES_DIR` from `src/targets/cursor/constants.ts`
- Verification:
  - `pnpm vitest run tests/unit/targets/claude-code/generator.test.ts tests/unit/targets/continue/generator.test.ts tests/unit/targets/cursor/generator.test.ts tests/unit/targets/copilot/generator.test.ts tests/unit/targets/gemini-cli/generator.test.ts tests/unit/targets/cline/generator.test.ts tests/unit/targets/codex-cli/generator.test.ts tests/unit/targets/junie/generator.test.ts tests/unit/targets/windsurf/generator.test.ts tests/unit/targets/root-instruction-paragraph.test.ts tests/unit/core/engine.test.ts`
  - `pnpm vitest run tests/import-generate-roundtrip.test.ts tests/unit/cli/commands/diff.test.ts tests/unit/core/generate-reference-rewrite.test.ts tests/integration/generate-reference-rewrite.integration.test.ts`
  - `pnpm build`
  - `pnpm test`
  - `pnpm lint`

# Target constants consolidation

- [x] Inventory scattered target-specific constants outside `constants.ts`
- [x] Move target-specific constants into each target's `constants.ts` and update usages
- [x] Run targeted verification, full verification, and append review notes

## Review (Target constants consolidation)

- QA Report — Target constants consolidation
- Acceptance criteria:
  - target-specific module-level constants now live in each target's `constants.ts` instead of being scattered through importers, helpers, generators, and linters: covered by source audit and `rg -n "^const [A-Z0-9_]+ = " src/targets --glob '!**/constants.ts'`
  - empty or underused target constants modules now own their target paths and canonical import destinations: covered by `src/targets/claude-code/constants.ts`, `src/targets/cursor/constants.ts`, `src/targets/continue/constants.ts`, `src/targets/junie/constants.ts`, `src/targets/gemini-cli/constants.ts`, `src/targets/copilot/constants.ts`, `src/targets/cline/constants.ts`, `src/targets/codex-cli/constants.ts`, and `src/targets/windsurf/constants.ts`
  - behavior remains unchanged after the constants consolidation: covered by full test/lint/build verification
- Edge cases covered:
  - engine metadata for primary root instruction paths still resolves correctly after constants moves: covered by `tests/unit/core/engine.test.ts`
  - importer-heavy targets still round-trip correctly after moving canonical destination constants into target modules: covered by `tests/import-generate-roundtrip.test.ts` and `tests/integration/import.integration.test.ts`
  - Windsurf MCP import still recognizes `.windsurf/mcp_config.example.json` after the cleanup: covered by `tests/unit/install/native-install-scope.junie-cline-windsurf-codex.test.ts` and `tests/import-generate-roundtrip.test.ts`
- Implementation notes:
  - centralized target ids, native paths, canonical destination paths, and Codex embedded-rule markers into per-target constants modules
  - updated importers, mappers, helper modules, and linters to consume those constants instead of local module-level declarations
  - left shared non-target modules like `src/targets/embedded-skill.ts` and `src/targets/root-instruction-paragraph.ts` unchanged because they are not owned by a single target
- Verification:
  - `rg -n "^const [A-Z0-9_]+ = " src/targets --glob '!**/constants.ts'`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm vitest run tests/import-generate-roundtrip.test.ts tests/unit/install/native-install-scope.junie-cline-windsurf-codex.test.ts`
  - `pnpm test`

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
- [x] Add untracked files (`src/install/skill-repo-filter.ts`, `tests/unit/core/artifact-path-map-packs.test.ts`)
- [x] Run full test suite to verify everything is passing
- [x] Commit all changes with a descriptive conventional commit message

# Fix npm trusted publishing release path

- [x] Add failing regression tests for trusted-publishing release metadata and workflow requirements
- [x] Switch package release metadata to the supported Changesets publish contract
- [x] Harden the GitHub publish workflow for trusted publishing on Actions runners
- [x] Run targeted verification, release-oriented checks, and post-feature QA
- [x] Append review notes with root cause, fix, and verification evidence

## Review (Fix npm trusted publishing release path)

- QA Report — npm trusted publishing release path
- Root cause:
  - `package.json` release automation had drifted to raw `npm publish --provenance --access public` instead of the repo's Changesets publish flow
  - package publish metadata did not explicitly declare `publishConfig` and used a non-canonical `repository.url`
  - `.github/workflows/publish.yml` used the runner's bundled npm without an upgrade step, which is a known risk area for current npm trusted publishing on GitHub Actions
- Acceptance criteria:
  - release metadata now stays on the Changesets publish contract and explicit public publish config: covered by `tests/unit/release/publish-config.test.ts`
  - publish workflow retains required trusted-publishing permissions and upgrades npm before invoking changesets/action: covered by `tests/unit/release/publish-config.test.ts`
- Changes made:
  - updated `package.json` `release` to `pnpm build && changeset publish`
  - added `publishConfig.access: public` and `publishConfig.provenance: true`
  - normalized `repository.url` to `git+https://github.com/sampleXbro/agentsmesh.git`
  - added `Upgrade npm for trusted publishing` step to `.github/workflows/publish.yml`
  - added regression test `tests/unit/release/publish-config.test.ts`
- Verification:
  - `pnpm vitest run tests/unit/release/publish-config.test.ts` initially failed before the fix, then passed after the fix
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `npm pack --dry-run`
- Result:
  - full suite passed: 145 test files, 1632 tests
  - publish tarball stayed clean at 6 files (`CHANGELOG.md`, `LICENSE`, `README.md`, `dist/cli.js`, `dist/cli.js.map`, `package.json`)
  - if npm still returns `E404` on the next CI run, the remaining check is npm package settings: confirm the trusted publisher entry points to repository `sampleXbro/agentsmesh` and workflow file `.github/workflows/publish.yml`

# E2E contract hardening matrix

- [x] Audit the existing e2e helpers, fixture surface, and target capability metadata against the requested contract gaps
- [x] Add failing exact target-contract coverage for Continue, including exact generated files, exact imported canonical tree, and exact rewritten reference assertions
- [x] Add generate -> import -> generate `--check` idempotency coverage for every supported target
- [x] Add install replay e2e coverage for sibling installs from the same source, multi-path replay collapse, remote GitHub `blob/...` and `tree/...` replay narrowing, and `install --sync --dry-run` side-effect freedom
- [x] Add conversion-off, stale-artifact cleanup, partial-capability subset, hooks round-trip, permissions round-trip, multi-extend precedence, watch expansion, and import-precedence e2e coverage
- [ ] Add one real validated fixture smoke contract per supported target and update `tests/e2e/README.md` to reflect the synthetic-vs-real split
- [x] Implement any minimal production fixes required by the new failing e2e coverage
- [x] Run targeted e2e verification, then `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the post-feature QA pass
- [x] Append review notes with acceptance coverage, edge cases, verification evidence, and any new lessons learned

## Review (E2E contract hardening matrix)

- Changes implemented:
  - expanded the exact target-contract matrix to include `continue`, exact generated file lists, exact imported canonical trees, and exact rewritten-reference assertions
  - added per-target `generate -> import -> generate --check` idempotency coverage across every supported target
  - added install replay coverage for sibling installs from one source, multi-path replay collapse, GitHub `tree/...` and `blob/...` narrowing replay, and `install --sync --dry-run` side-effect freedom
  - added new e2e coverage for conversion-off projections, stale-artifact cleanup, partial-capability subset contracts, hooks round-trip, permissions round-trip, multi-extend precedence, watch feature edits, and import precedence
  - added a `fixtures-real/` smoke lane plus README guidance that separates synthetic fixtures from optional validated real exports
  - fixed production gaps exposed by the new coverage: dry-run replay forwarding, Windsurf MCP warnings, stale generated artifact cleanup, Cursor and Gemini root-import precedence/normalization, Windsurf scoped-rule regeneration, and Gemini absolute-path cleanup during compat-root import
- Tests added:
  - `tests/e2e/install-replay.e2e.test.ts`
  - `tests/e2e/install-remote.e2e.test.ts`
  - `tests/e2e/conversion-off.e2e.test.ts`
  - `tests/e2e/partial-capability-contracts.e2e.test.ts`
  - `tests/e2e/stale-artifact-cleanup.e2e.test.ts`
  - `tests/e2e/hooks-roundtrip.e2e.test.ts`
  - `tests/e2e/permissions-roundtrip.e2e.test.ts`
  - `tests/e2e/import-precedence.e2e.test.ts`
  - `tests/e2e/multi-extend-precedence.e2e.test.ts`
  - `tests/e2e/watch-features.e2e.test.ts`
  - `tests/e2e/real-fixtures-smoke.e2e.test.ts`
  - expanded `tests/e2e/target-contract-matrix.e2e.test.ts`
- Verification:
  - targeted e2e reruns for the repaired regressions:
    - `pnpm vitest run --config vitest.e2e.config.ts tests/e2e/generate-reference-rewrite-matrix.e2e.test.ts tests/e2e/import-reference-rewrite.e2e.test.ts`
    - `pnpm vitest run tests/integration/import.integration.test.ts`
  - repo gates:
    - `pnpm build`
    - `pnpm lint`
    - `pnpm typecheck`
    - `pnpm test:e2e`
    - `pnpm test`
- QA Report — E2E contract hardening matrix
- Acceptance criteria:
  - exact target-contract and rewritten-reference assertions now cover every supported target, including Continue: covered by `tests/e2e/target-contract-matrix.e2e.test.ts`
  - serializer drift and unstable import normalization are guarded by generate/import/check loops for every supported target: covered by the idempotency block in `tests/e2e/target-contract-matrix.e2e.test.ts`
  - install replay contracts cover sibling installs, multi-path collapse, GitHub blob/tree narrowing, and dry-run side-effect freedom: covered by `tests/e2e/install-replay.e2e.test.ts` and `tests/e2e/install-remote.e2e.test.ts`
  - conversion-off, stale cleanup, partial-support subsets, hooks/permissions round-trips, extend precedence, watch regeneration, and import precedence now have dedicated e2e coverage: covered by the new focused e2e files listed above
- Edge cases checked:
  - duplicate permission entries, allow+deny ordering, and partial-support re-import behavior for Claude, Cursor, and Gemini
  - multiple hook events and handlers, timeout rounding, env preservation, quoting, and stable wrapper naming
  - deterministic warnings for Cursor permissions, Gemini hook subset, Windsurf MCP subset, and Copilot hook subset
  - stale-file deletion when commands, agents, hooks, MCP, ignore, or permissions are removed from canonical
  - watch-mode regeneration across edits to commands, skills, MCP, hooks, and permissions without stale output drift
- Gaps identified:
  - the repo still does not contain actual human-validated per-target export fixtures, so the new `tests/e2e/real-fixtures-smoke.e2e.test.ts` lane is scaffolded and documented but remains a placeholder until real fixtures are added
- Lessons learned:
  - dist-backed e2e helpers execute `dist/cli.js`, so production-behavior fixes must be rebuilt before interpreting targeted e2e failures

# Cline MCP filename contract

- [x] Rename the Cline MCP artifact contract from `.cline/mcp_settings.json` to `.cline/cline_mcp_settings.json` across source, tests, and docs
- [x] Run targeted Cline generation/import verification and the required repo gates
- [x] Append review notes with the final contract and verification evidence

## Review (Cline MCP filename contract)

- Changes implemented:
  - changed the Cline MCP target constant to `.cline/cline_mcp_settings.json`
  - updated generator, importer, built-in target metadata, stale cleanup, unit tests, integration tests, e2e tests, and docs to use the corrected filename
  - aligned documented project-structure and Cline target docs with the corrected contract
- Verification:
  - `pnpm build`
  - `pnpm vitest run tests/unit/targets/cline/generator.test.ts tests/unit/targets/cline/importer.test.ts tests/unit/core/engine.test.ts tests/import-generate-roundtrip.test.ts tests/unit/install/native-install-scope.junie-cline-windsurf-codex.test.ts tests/agents-folder-structure-research.test.ts`
  - `pnpm vitest run --config vitest.e2e.config.ts tests/e2e/cline-content-contract.e2e.test.ts tests/e2e/target-contract-matrix.e2e.test.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- QA Report — Cline MCP filename contract
- Acceptance criteria:
  - Cline generation emits `.cline/cline_mcp_settings.json`: covered by `tests/unit/targets/cline/generator.test.ts`, `tests/unit/core/engine.test.ts`, and `tests/e2e/cline-content-contract.e2e.test.ts`
  - Cline import reads `.cline/cline_mcp_settings.json` back into canonical MCP: covered by `tests/unit/targets/cline/importer.test.ts`
  - cross-target and round-trip contracts stay stable after the rename: covered by `tests/import-generate-roundtrip.test.ts` and `tests/e2e/target-contract-matrix.e2e.test.ts`
- Edge cases checked:
  - malformed Cline MCP settings still import safely
  - native-install scope detection for Cline MCP files still resolves the target correctly
  - stale generated-output cleanup now deletes the renamed Cline MCP artifact path
- Gaps identified:
  - none
