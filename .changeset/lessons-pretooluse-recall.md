---
"agentsmesh": minor
---

Deterministic pre-edit lesson recall via a `PreToolUse` hook.

`agentsmesh init --lessons` now wires the recall hook under **both** `PreToolUse` and `PostToolUse`, and `agentsmesh lessons hook` is event-aware (it echoes the harness `hook_event_name`). On targets whose hooks can inject context before a tool call (e.g. Claude Code), matching lessons are now surfaced **before the first edit/command** — guarding the "first touch" the previous PostToolUse-only design left unguarded — with no extra model turn and no compliance dependence. Session dedup keeps each lesson injected at most once per session, and `PostToolUse` remains as the fallback for harnesses that support only post-call context injection. Existing projects pick this up by re-running `agentsmesh init --lessons` (idempotent) and `agentsmesh generate`; behavior is unchanged when no `hook_event_name` is supplied (defaults to `PostToolUse`).
