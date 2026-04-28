# Plan: rulesync issue parity in agentsmesh

Goal: ensure agentsmesh covers the behaviour described in 13 verified rulesync issues with regression tests, and close real gaps with TDD.

## Verified rulesync issues (from GitHub MCP)

- #4 OpenHands CLI (open) — defer to plugin path; document
- #900 link rewriting (open) — covered by link-rebaser; add e2e leak guard
- #1515 Cursor manual rule cross-target inversion (closed) — verify Cursor `alwaysApply: false` no globs/desc → claude-code does not become always-on
- #1317 hook scripts not copied (open) — only Copilot covers; gap for claude-code/cursor/windsurf/cline
- #1418/1420/1422/1417/1547 permissions backlog — silent drop on most targets, no lint signal
- #329 plugin marketplace (open) — partially covered by extends/install (Git)
- #1403 npm-distributed skills (open) — defer; not implemented
- #1239 Windows/CRLF drift (open, BUG) — paths normalized; LF normalization on write missing
- #1247 global sync regression (closed) — verify global mode multi-target distribution

## Implementation order (TDD)

1. **#900 link leak guard** — e2e test that grepping all generated artifacts across all 12 targets finds zero `.agentsmesh/` substring inside markdown link destinations
2. **#1515 cross-target rule scope** — test that a Cursor manual rule (alwaysApply: false, no globs, no description) is either dropped or marked manual when emitted to claude-code
3. **#1247 global multi-target** — sanity test that `--global` emits per-target paths for several targets in one run
4. **#1239 CRLF byte-stability** — failing test that canonical `.md` content with CRLF writes byte-identical output to LF input; implement LF normalization in `writeFileAtomic` for text files
5. **#1317 hook script projection** — failing tests that referenced hook script files are projected for claude-code/cursor/windsurf/cline; implement script-asset projection or add lint warning
6. **#1418/1420/1422/1417/1547 permissions silent drop** — failing test that lint emits warning when canonical `permissions.yaml` is non-empty and target has `none` permissions support; implement diagnostic
7. **Quality gates** — `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix all gates
8. **Update lessons** — record any mistakes encountered

## Deferred (architectural; need design discussion)

- #4 OpenHands as built-in target (full add-agent-target workflow) — currently document plugin path only
- #1403 npm-source for `agentsmesh install` (new source kind, registry resolution)
