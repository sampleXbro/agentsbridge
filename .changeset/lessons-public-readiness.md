---
'agentsmesh': minor
---

feat(lessons): public-readiness hardening — discoverable flags, safer capture/recall, clearer errors

The lessons subsystem is polished for general use, closing the gaps a first-time
external user would hit. No breaking changes to the documented happy path.

**Added**

- `agentsmesh lessons query` now documents `--session`, `--no-dedup`, and `--ids`
  in `--help` (they were parsed but invisible), and every `lessons` subcommand
  **rejects unknown flags** with the correct usage instead of silently ignoring
  them — a typoed `--trigger-flie` no longer drops a trigger from a capture.
- Running a `lessons` command from a subdirectory of a project now **warns**
  (`query` finds no graph here; `add` flags that it is about to create a stray
  `.agentsmesh`) instead of silently returning empty or writing to the wrong place.
- A present-but-malformed `.agentsmesh/lessons/config.json` now surfaces a stderr
  warning rather than silently reverting to defaults.

**Changed**

- Capture rejects a rule longer than 2000 characters (`OVERSIZED_RULE`), and the
  recall hook truncates any over-long rule before injecting it into agent context,
  so a graph from a cloned third-party repo cannot flood the context with one
  giant rule. The lessons reference now documents this **trust model**.
- `agentsmesh lessons hook` bounds the stdin payload it reads, so a runaway pipe
  cannot exhaust memory.
- `lessons` errors now surface verbatim in `--json` output (e.g.
  `"Recall needs a predicate…"`) instead of a generic `Command 'lessons' failed`.
- `agentsmesh init --lessons` only prints "the graph starts empty" when it
  actually created the graph on this run.
