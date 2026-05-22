# Ultrareview Fix-Plan — develop branch (37 unpushed commits)

Order: CRITICAL → HIGH → MEDIUM → LOW. TDD for every behavior change.

## CRITICAL

- [ ] **C1** `apply-decisions.ts:54` — `buildLinkRewrites` compares `token.destination` (raw scanned) against `resolved.link.path` (post-`stripPath`). Bodies with `{baseDir}/x.md` or Windows-style `..\x.md` silently no-op. **Fix:** call with `resolved.link.raw`. **Test:** body containing `{baseDir}/foo.md`.
- [ ] **C2** `apply-decisions.ts:79-83` — basename collision (`docs/A/README.md` + `docs/B/README.md` → `references/README.md`) drops second content + both citations point at one file. **Fix:** disambiguate via `resolvedRelative` slug when collision. **Test:** two distinct outside paths sharing a basename.

## HIGH

- [ ] **H1** `run-uninstall.ts:160-170` — per-pack try/catch in apply loop; collect failures; always run post-generate over surviving installs.
- [ ] **H2** `vitest.config.ts` — coverage honesty: re-include orchestrator files (`run-install-locked`, `run-install-execute`, `manual-install-scope`, `native-path-pick-infer`) or annotate explicitly. Prefer adding minimal targeted tests + removing from exclude.
- [ ] **H3** `install-flags.ts:21,30` — `.trim()` `explicitPath` to match `target`/`as` symmetry.
- [ ] **H4** Tighten loose tests:
  - `tests/unit/core/reference/import-maps-global-branches.test.ts:31,51,57,64`
  - `tests/unit/core/reference/import-maps-misc-branches.test.ts:29,45`
  - `tests/unit/targets/continue/importer-branches.test.ts:29,45,57,76`
  - `tests/unit/targets/codex-cli/importer-rules-branches.test.ts:40,49`
  - `tests/unit/install/uninstall/uninstall-decisions-edge.test.ts:99`
  - `tests/unit/targets/import/descriptor-default-mappers-branches.test.ts:63,74,85`
- [ ] **H5** `native-path-pick-infer.ts` — replace 8-target hardcoded ladder with descriptor-driven dispatch (use `descriptor.importer.*.source.project` paths).
- [ ] **H6** `target-descriptor.schema.ts:140-173` — require `metadata`, drop `as unknown as` cast.
- [ ] **H7** File-size cap (≥200):
  - `src/install/run/run-install-locked.ts` (295) → split marketplace-branch + single-pack-branch.
  - `src/install/classify/layout-detect.ts` (244) → extract per-detector helpers.
- [ ] **H8** README + website: add `--all` flag to install docs/synopsis; add `AGENTSMESH_STRICT_PLUGINS` to env-var table; verify env-var table parity.

## MEDIUM

- [ ] **M1** `run-uninstall.ts:88-94` — under `--json`, suppress `logger.error` stderr leak.
- [ ] **M2** `uninstall-decisions.ts:102` — `migrateLegacyManifest` writes under dry-run. Thread `dryRun` flag.
- [ ] **M3** `detect-modified.ts` + `install-manifest-hash.ts` — normalize line endings + strip BOM for text extensions before hashing.
- [ ] **M4** `fs-traverse.ts:74-87` — skip symlinks in hash/uninstall traversal.
- [ ] **M5** `apply-uninstall.ts` — add `partial: boolean` to `AppliedRemoval` for JSON consumers.
- [ ] **M6** `install-lock.ts:33` — `mkdir(canonicalDir, { recursive: true })` before acquire.
- [ ] **M7** `renderers/installs.ts:75-86` — replace hand-rolled help banner with `printCommandHelp('installs')`.
- [ ] **M8** `help-data.ts:163` + `uninstall.mdx:28` — note `--force` is implied by `--json`.
- [ ] **M9** `merge-commands.ts:50-61` — replace dead defensive branch with invariant assertion.
- [ ] **M10** `install-name.ts:66-70` — iterative `git+` strip (recursion guard).

## LOW

- [ ] **L1** `prompt-io-defaults.test.ts:16-24` — use `vi.spyOn` instead of `Object.defineProperty(process, 'stdin')`.
- [ ] **L2** `skill-mirror.ts:24-30` — `NATIVE_AGENTS_SKILL_WRITERS` → `descriptor.project.ownsSharedSkillDir`.
- [ ] **L3** `native-format-detector.ts:60-74` — restore bare-dir markers if regression unintended.
- [ ] **L4** `descriptor-import-runner.ts:55,115` — type annotation for `let mapping`.
- [ ] **L5** `conversions.ts:49,70` — add conversions schema + drop cast.
- [ ] **L6** `registry.ts:13-27` — lint rule against top-level `getDescriptor` in `src/targets/*/index.ts`.

## Verification

After each phase: `pnpm test` (unit + integration). Final: `pnpm build && pnpm lint && pnpm typecheck && pnpm test`.

## Deferred to a follow-up PR

- **H5** `src/install/native/native-path-pick-infer.ts` — replace the 8-target hardcoded ladder with descriptor-driven dispatch. Requires either:
  - Adding an `installPickHints` field to `TargetDescriptor` and populating it across all 27 builtin descriptors, OR
  - Deriving hints at module load by parsing each descriptor's `project.managedOutputs.dirs` for `<scope>/{rules,commands,agents,skills}` patterns, with bespoke overrides for `gemini-cli` (namespaced commands), `cline` (workflows dir), and `codex-cli` (flat `.codex` layout).
  - Until that lands, the file stays in the vitest coverage exclude list (category 5).

## Out of scope

- Pre-existing 200-line cap violators not touched in this PR (`skill-import-pipeline.ts`, `builtin-targets.ts`, etc.).
