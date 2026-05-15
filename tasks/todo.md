# P0 Implementation — G1 + G2

**Updated:** 2026-05-12 after deeper investigation.

## Correction to initial analysis

- **G1:** Shared pipeline EXISTS at `src/targets/import/shared/skill-import-pipeline.ts`. Initial verification (Agent #1) read only `shared-import-helpers.ts` and missed `shared/skill-import-pipeline.ts`. Real remaining duplication: the **dispatch loop** in Cline / Windsurf / Codex adapters (read SKILL.md → try recognizers → fall back). L132 confirms it caused bug recurrence.
- **G2:** Harness is mature (45s × 1.5 coverage timeout, per-test temp roots, chokidar ready awaited, Windows polling, lock-file path ignore). Real remaining gaps: tests scrape logs/files for cycle signal (timing variance); `_suppressAgentsmeshDirUntil` is dead code; no `flake:watch` validator.

## G1 — Extract skill-import dispatch loop

**Goal:** consolidate Cline / Windsurf / Codex dispatch loops behind `importSkillsDirectory(options, recognizers)` so reserved-artifact / projected-agent / command-skill handling lives in one place.

- [x] G1.1 RED: add tests for `importSkillsDirectory` — source-dir fallback (Codex pattern), recognizer order, default fallback to `importDirectorySkill`, stale-skill-dir cleanup
- [x] G1.2 GREEN: implement `importSkillsDirectory` + `projectedAgentRecognizer` + `commandSkillRecognizer` in `shared/skill-import-pipeline.ts`
- [x] G1.3 Migrate `src/targets/cline/skills-adapter.ts` to use orchestrator (drop inline dispatch)
- [x] G1.4 Migrate `src/targets/windsurf/skills-adapter.ts` to use orchestrator
- [x] G1.5 Migrate `src/targets/codex-cli/skills-adapter.ts` to use orchestrator (2 recognizers + fallback dir)
- [x] G1.6 Run `pnpm test tests/unit/targets/{cline,windsurf,codex-cli,import}` GREEN
- [x] G1.7 `pnpm build && pnpm test:e2e -- importer` GREEN
- [x] G1.8 `pnpm lint && pnpm typecheck` GREEN
- [x] G1.9 Add lesson to `tasks/lessons.md`

## G2 — Watch test determinism + dead code

**Goal:** replace timing-scrape with a deterministic per-cycle callback; delete unused param; add a flake validator.

- [x] G2.1 Remove dead `_suppressAgentsmeshDirUntil` parameter from `shouldIgnoreWatchPath` (and its set-but-never-read assignments in `runWatch`)
- [x] G2.2 RED: test asserting `runWatch({ onCycle })` fires `onCycle({ featuresChanged })` once per regen, both initial and after edits
- [x] G2.3 GREEN: thread `onCycle` from `runWatch` options through `run()` cycles
- [x] G2.4 Migrate `runMatrix when features change` test to wait on `onCycle` instead of log/spy timing
- [x] G2.5 Fix tautological `logs Regenerated` test (currently captures startup call only) to assert the post-edit cycle via `onCycle`
- [x] G2.6 Add `scripts/flake-check-watch.ts` (N=10 watch-test runs under COVERAGE=1)
- [x] G2.7 Wire `"flake:watch": "tsx scripts/flake-check-watch.ts"` in `package.json`
- [x] G2.8 Run `pnpm flake:watch` locally to validate stability
- [x] G2.9 `pnpm lint && pnpm typecheck && pnpm test` GREEN
- [x] G2.10 Add lesson to `tasks/lessons.md`

## Verification gate

- [x] V1: `pnpm lint` clean
- [x] V2: `pnpm typecheck` clean
- [x] V3: `pnpm typecheck:tests` if shipped — not part of this batch
- [x] V4: `pnpm test` full suite
- [x] V5: `pnpm test:e2e` full
- [x] V6: `pnpm matrix:verify`
- [ ] V7: Commit with `feat(import): consolidate skill-import dispatch loop` and `refactor(watch): expose onCycle and remove dead state` (awaiting user)

## Out of scope

- Splitting >200 LOC files (G16)
- New CLI commands from the wider plan (T1–T16)
- Watch behavior changes beyond the test-determinism hook
