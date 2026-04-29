# Plan: full test run and failure fixes

Goal: run the complete test suite, identify any failing tests, and fix real regressions without disturbing unrelated worktree changes.

## Checklist

- [x] Run `pnpm test` and capture the failure surface.
- [x] Attribute failures to current code, existing dirty changes, or test flake using targeted reproduction.
- [x] For real regressions, add or adjust failing coverage first where needed, then implement the smallest fix.
- [x] Run targeted tests for fixed areas.
- [x] Run full verification gates (`pnpm test`, plus lint/typecheck if code changes touch TypeScript).
- [x] Run post-feature QA before marking complete.

## Previous Plan Snapshot

The prior working plan in this file concerned rulesync issue parity and is intentionally preserved here for context:

- #900 link leak guard
- #1515 cross-target rule scope
- #1247 global multi-target
- #1239 CRLF byte-stability
- #1317 hook script projection
- #1418/#1420/#1422/#1417/#1547 permissions silent drop diagnostics
