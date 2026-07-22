---
"agentsmesh": minor
---

Lessons recall now escalates on repeat failures. When `agentsmesh lessons hook` runs as a `PreToolUse` first-touch guard and the exact action about to run has already failed twice or more (per the opt-in outcome log) with a captured lesson covering it, the covering rule is re-injected above the normal recall bullets as a `RECURRENT FAILURE` escalation — and it cuts through per-session dedup, since a rule the agent saw but did not apply must be shown again. Advisory context only, once per action per session; the covering rule is shown exactly once (the escalation is its delivery), and the default telemetry-off path is unaffected.

Effectiveness telemetry is now attributed per harness session. The hook stamps the harness `session_id` (and a per-batch relevance `rank`) onto the `delivered` / `failure` rows of `.agentsmesh/lessons/outcome-log.jsonl` and onto recall telemetry, so `agentsmesh lessons stats` groups by real sessions and a failure only impeaches deliveries from its own session — no `AGENTSMESH_SESSION_ID` export needed on hook-driven recalls.

Added an opt-in `repairTriggers` flag (default `false`) in `.agentsmesh/lessons/config.json` that repairs degraded triggers at capture time: a broad or wide `file_glob` is narrowed toward the evidence file's directory class, a stopworded or over-long keyword gets a matchable variant added beside it, and a keyword that tokenizes to nothing is dropped — each surfaced as a `NARROWED_GLOB` / `KEYWORD_VARIANT_ADDED` / `DROPPED_KEYWORD` warning on the capture result. It never blocks a capture, never rewrites a glob without covering evidence, and never leaves a lesson with zero triggers.
