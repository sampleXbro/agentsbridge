---
name: lessons
description: Full operating manual for the agentsmesh lessons system (recall + capture). Consult when running any `agentsmesh lessons` subcommand (query, add, topics, show, deprecate, journal, validate, import-md), choosing a topic or trigger flags, using the lessons MCP tools, or when unsure how to phrase or capture a lesson.
---

## Purpose

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
- Keep each `--trigger-kw` a **short distinctive phrase** (≤5 tokens, e.g. `filterOption cast`),
  not a sentence. Recall matches a keyword only as a substring of `--keyword` or a contiguous
  token-run in the file/command, so a long descriptive pattern almost never fires — `add` and
  `validate` warn `LOW_SIGNAL_KEYWORD` when one is too long.
- Find the topic id with `agentsmesh lessons topics`.
- Brand-new area? Pass `--new-topic --topic-summary "<one line>"`.

**Rejected excuses:** *"it wasn't really a failure"* → it was. *"I'll capture it later"*
→ no. *"no topic fits"* → `agentsmesh lessons topics` then `--new-topic`.

## No shell?

Use the `lessons_query` and `lessons_add` MCP tools — the same two operations.

## Full command set

Run `agentsmesh lessons --help` for everything. Beyond `query` and `add`:

- `agentsmesh lessons topics` — list topic ids + summaries.
- `agentsmesh lessons show <id>` — inspect a single lesson.
- `agentsmesh lessons deprecate <id>` — retire a lesson that no longer holds.
- `agentsmesh lessons untrigger <id> <trigger-id>` — detach one trigger from a lesson (e.g. to drop a `LOW_SIGNAL_KEYWORD` keyword and re-`add` a short one); garbage-collects the trigger node if no other lesson uses it.
- `agentsmesh lessons journal` — review recent capture/recall activity.
- `agentsmesh lessons validate` — check the graph for integrity problems.
- `agentsmesh lessons import-md <file>` — bulk-import lessons from Markdown.
- `agentsmesh lessons stats` — recall-effectiveness telemetry (opt-in).

**Recall tuning (optional).** On a large, high-fanout graph, recall can return many lessons per call. Drop a `.agentsmesh/lessons/config.json` with `{ "recallLimit": 5, "recallMaxTokens": 250 }` to lower the per-recall caps for this project (defaults: 10 / ~400 tokens). Both fields are optional; `--top`/`--max-tokens`/`--all` still override per call.

## Why this matters

These two commands ARE the system. Skip them and the system does not exist.