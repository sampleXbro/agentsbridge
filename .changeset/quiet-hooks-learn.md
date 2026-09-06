---
'agentsmesh': minor
---

**Changed — lessons recall runs once per tool call.** `agentsmesh init --lessons` no longer wires `agentsmesh lessons hook` under `PostToolUse`, and removes an entry an older scaffold left there while leaving your own `PostToolUse` hooks alone. `PreToolUse` fires before every tool call, so the second recall only re-ran after the fact: one more process and one more context block per call, with advice that arrived too late to apply. No target injects on `PostToolUse` without also supporting `PreToolUse`, so nothing is lost.

**Added — `"telemetry": true` in `.agentsmesh/lessons/config.json`.** The recall, capture and outcome logs behind `lessons stats`, effectiveness ranking and the `validate` health view could previously be enabled only by an environment variable. A hook spawned by a desktop app inherits none of your shell exports, so with that gate every hook stayed silent while the CLI in a terminal kept logging, and the effectiveness signal quietly died. The project config is visible to any process; `AGENTSMESH_LESSONS_TELEMETRY` still overrides per process (`1` on, `0` off).

**Added — `NEVER_RECALLED` in `agentsmesh lessons validate`.** One aggregate warning, with every id on `lessonIds`, for active lessons that predate the recall log's window and never fired across at least 500 recalls. In a mature graph that was 59% of all lessons: trigger cost with no return. Advisory only; inspect with `show`, retarget the trigger, or `deprecate`.
