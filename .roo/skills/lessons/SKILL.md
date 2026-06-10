---
name: lessons
description: Full operating manual for the agentsmesh lessons system (recall + capture). Consult when running any `agentsmesh lessons` subcommand (query, add, topics, show, deprecate, journal, validate, import-md), choosing a topic or trigger flags, using the lessons MCP tools, or when unsure how to phrase or capture a lesson.
---

# Lessons — full operating manual

The lessons system is two shell commands: **Recall** (before you act) and **Capture**
(after any failure). The always-on rule in the root instructions is the trigger; this
skill is the complete reference. The graph at `../../../.agentsmesh/lessons/lessons.json` is
canonical — NEVER edit it by hand.

## Recall — before every file edit and every shell command

There is no read-only carve-out. The very first action of any turn that will touch a
file or run a command is to run `agentsmesh lessons query --file <path-about-to-edit> --cmd <command-about-to-run>`
(add `--keyword <text>` to match by task). Apply EVERY returned rule, then act.

**Rejected excuses — each one means *query first*:** *"the edit is small"*, *"I already
know this"*, *"it's read-only / I'm just looking / just investigating"*, *"this command
can't change anything"* (git, ls, cat, test runs, coverage **still count**), *"I'll do
it later"*.

## Capture — immediately after any failure or mistake

A failure is NOT limited to red test output. It includes a user correction or pushback,
a failing test / CI / lint / typecheck, a code-review comment, a regression, a wrong
assumption you made, work you had to redo, or behavior that surprised you.

Run `agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <commit-sha|lesson-id>`.

- Add `--trigger-cmd <regex>` and/or `--trigger-kw <text>` to widen when the lesson fires.
- Find the topic id with `agentsmesh lessons topics`.
- Brand-new area? Pass `--new-topic --topic-summary "<one line>"`.

**Rejected excuses:** *"it wasn't really a failure"* → it was. *"I'll capture it later"*
→ no. *"no topic fits"* → `agentsmesh lessons topics` then `--new-topic`.

## No shell?

Use the MCP tools — same operations as the CLI: `lessons_query` (recall),
`lessons_add` (capture), `lessons_topics` (list topics), `lessons_show`
(inspect a topic's lessons), and `lessons_deprecate` (retire a lesson).
Maintainer-only ops (validate / prune / merge / import-md) stay CLI-only.

## Full command set

Run `agentsmesh lessons --help` for everything. Beyond `query` and `add`:

- `agentsmesh lessons topics` — list topic ids + summaries.
- `agentsmesh lessons show <topic>` — inspect a topic's lessons.
- `agentsmesh lessons deprecate <id> [--superseded-by <id>]` — retire a lesson that no longer holds.
- `agentsmesh lessons merge <loser-id> <keeper-id>` — fold a duplicate lesson into another.
- `agentsmesh lessons untrigger <lesson-id> <trigger-id>` — detach one trigger in place.
- `agentsmesh lessons strip-markers` — strip managed-block markers from rule text.
- `agentsmesh lessons prune [--apply] [--cap <n>]` — trim over-cap triggers and GC orphan triggers/topics.
- `agentsmesh lessons journal` — review recent capture/recall activity.
- `agentsmesh lessons validate` — check the graph for integrity problems.
- `agentsmesh lessons stats` — recall-effectiveness telemetry (opt-in).
- `agentsmesh lessons import-md <file>` — bulk-import lessons from Markdown.

## Recall caps

Per-project caps live in `../../../.agentsmesh/lessons/config.json`: `recallLimit`
(max lessons per recall) and `recallMaxTokens` (cumulative rule-token budget).
These config keys are canonical; the `--top` / `--max-tokens` flags are the
per-call overrides for the same two limits. `recallMaxTokens` is approximate —
the per-rule cost is estimated as `rule.length / 4`, not a real tokenizer.

## Why this matters

These two commands ARE the system. Skip them and the system does not exist.