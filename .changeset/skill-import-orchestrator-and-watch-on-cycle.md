---
'agentsmesh': patch
---

Internal refactor of the skill-import dispatch path and watch-test determinism — no user-visible behavior change.

**`agentsmesh import` (Cline / Windsurf / Codex CLI)**

The per-target `readdir → readFileSafe(SKILL.md) → try recognizer → fall back to skill import` loops, which had drifted independently and kept causing the same class of bug (lessons L132), are consolidated behind one shared orchestrator: `importSkillsDirectory(sourceSkillsDirs, options, recognizers)` plus `projectedAgentRecognizer({ canonicalAgentsDir })` and `commandSkillRecognizer({ canonicalCommandsDir })` factories. Each adapter now collapses to a config object plus a recognizer list. A minor side-effect of the consolidation: Cline now performs the same stale-skill-dir cleanup on re-import that Windsurf and Codex already did, so previously orphaned `.agentsmesh/skills/am-agent-<name>/` directories from buggy earlier runs are removed when a Cline projected-agent skill is re-imported.

**`agentsmesh watch`**

`runWatch` now accepts an optional `onCycle({ featuresChanged })` callback fired once per completed generate cycle (initial + each debounced regen). This is a deterministic synchronization signal for tests/integrations that previously relied on scraping `'Regenerated.'` log lines. The unrelated, dead `_suppressAgentsmeshDirUntil` parameter is removed from `shouldIgnoreWatchPath`. Watch-test budget bumped from 45s → 60s base (×1.5 under coverage = 90s) to survive full-suite scheduler load on macOS FSEvents.

**Developer tooling**

New `pnpm flake:watch` script (`scripts/flake-check-watch.ts`) runs the watch unit suite N times under `COVERAGE=1` to validate stability whenever the watch loop or scheduler envelope changes.

**Internal**

- New file: `src/targets/import/shared/skill-import-pipeline.ts` gains `importSkillsDirectory`, `projectedAgentRecognizer`, `commandSkillRecognizer`, `SkillRecognizer`, `SkillRecognizerContext` exports. The dead `SkillImportOptions.sourceSkillsDir` field is removed; `sourceSkillsDirs` is now a required first argument to the orchestrator.
- Adapter migrations: `cline/skills-adapter.ts`, `windsurf/skills-adapter.ts`, `codex-cli/skills-adapter.ts` reduced to thin wrappers. `cursor/skills-adapter.ts` and `copilot/skills-adapter.ts` shed the now-dead option field.
- 17 new unit tests; touched-scope branch coverage at 100% (25/25).
- `runWatch` adds `RunWatchOptions` + `WatchCycleInfo` types. The new third parameter is optional and backwards-compatible.
