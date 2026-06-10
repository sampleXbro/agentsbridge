---
name: lessons
description: Full operating manual for the agentsmesh lessons system (recall + capture). Consult when running any `agentsmesh lessons` subcommand (query, add, topics, show, deprecate, merge, untrigger, strip-markers, journal, validate, stats, prune, import-md), choosing a topic or trigger flags, using the lessons MCP tools, or when unsure how to phrase or capture a lesson.
---

# Lessons — operating manual

Two commands: **Recall** before you act, **Capture** after any failure. The graph
`.agentsmesh/lessons/lessons.json` is canonical — never hand-edit.

## Recall — before every file edit / shell command (no read-only exception)

`agentsmesh lessons query --file <path> --cmd <command>` (add `--keyword <text>` to
match by task), then apply every rule returned. A predicate-less query is rejected;
**keyword-only recall is the anti-pattern** — most lessons are keyed to a
`file_glob`/`command_pattern` and won't surface (the CLI warns). Excuses ("small edit",
"I already know this", "just looking / read-only", "later") all mean: query first.

## Capture — immediately after any failure

Any failure counts, not just red tests: a failing test/CI/lint/typecheck, a code
review, a user correction, a regression, or a wrong assumption — yours or anyone's.

`agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <sha|lesson-id>`

- **At least one trigger is required** (capture rejected otherwise — an untriggered
  lesson can never be recalled). Prefer `--trigger-file`: the most reliable trigger, it
  fires on `--file` recall. A keyword alone is discouraged (`KEYWORD_ONLY_LESSON`).
- Widen with `--trigger-cmd <regex>` / `--trigger-kw <text>`. New area:
  `--new-topic --topic-summary "<line>"` (list ids with `agentsmesh lessons topics`).

## No shell? — MCP tools

`lessons_query`, `lessons_add`, `lessons_topics`, `lessons_show` (inspect a topic),
`lessons_deprecate` (retire). validate / prune / merge / import-md are CLI-only.

## Other subcommands

`agentsmesh lessons <cmd>`: `show` · `deprecate` (`--superseded-by`) · `merge` ·
`untrigger` · `strip-markers` · `prune` (`--apply`; trims over-cap triggers, GCs
orphan triggers/topics) · `journal` · `validate` · `stats` · `import-md`. Full
help: `agentsmesh lessons --help`.

## Recall caps

`.agentsmesh/lessons/config.json`: `recallLimit` / `recallMaxTokens` (canonical;
per-call overrides `--top` / `--max-tokens`). `recallMaxTokens` is approximate —
`rule.length / 4`, not a real tokenizer.
