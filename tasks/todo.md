# Lessons efficiency: three fixes (2026-09-06)

Evidence (recall-log, 5,521 recalls since 2026-07-17): 63% of recalls arrive
<3s after a same-shaped one (Pre+Post double fire); outcome-log dead since
2026-07-22 because the telemetry gate is an env var hooks spawned by the
desktop app never see; 322 of 542 lessons never delivered.

## 1. Stop the PostToolUse double fire
- [x] scaffold: drop PostToolUse from RECALL_EVENTS; remove a previously
      scaffolded managed PostToolUse recall entry (migration); tests first
- [x] this repo: .agentsmesh/hooks.yaml loses the PostToolUse recall entry;
      `agentsmesh generate`
- [x] docs: cli/lessons.mdx hook block + bullet

## 2. Revive the effectiveness loop
- [x] telemetry gate reads `.agentsmesh/lessons/config.json` `telemetry: true`
      as well as the env var (env `0` forces off); tests first
- [x] every writer passes projectRoot; defaultLessonsConfig gains `telemetry`
- [x] this repo: config.json `telemetry: true`
- [x] docs: reference + guides telemetry sections, config.json shape

## 3. Surface never-recalled lessons
- [x] validate-health: NEVER_RECALLED summary finding (active, predates the
      recall window, not always-on, log >= 500 recalls); tests first
- [x] docs: reference/lessons.mdx health findings

## Gate
- [x] full suite + floor, typecheck, lint, knip, website build; commit; push

## Verified on this repo
- `.claude/settings.json`: PreToolUse 1 recall entry, PostToolUse 0; `generate --check` in sync
- hook probe with NO telemetry env var: outcome rows 1258 -> 1261 (config gate writes);
  with env=0: silent (override wins)
- `validate`: NEVER_RECALLED lists 207 active lessons (predating the window; excludes
  always-on and post-window captures) across 5,522 recalls since 2026-07-17
