---
name: lessons
description: Use when about to edit a file or run a state-changing command, or after any failure, correction, or surprising result.
---

# Lessons — operating manual (Iron Law)

## The Iron Law

**NO MUTATION WITHOUT RECALL. NO COMPLETION WITHOUT A CAPTURE DECISION.**

Violating the letter is violating the spirit. Edited a file or ran a state-changing
command without recall? Process violation. Did the turn hit a failure / correction /
regression / wrong assumption / surprise and you have not captured (nor stated
`Lesson: none`)? The task is INCOMPLETE — and the user will check. The graph
`.agentsmesh/lessons/lessons.json` is canonical — never hand-edit.

## Recall — before each file edit and each state-changing command

`agentsmesh lessons query --file <path> --cmd <command>`, then apply every rule.
Pure-read commands (read-only) and the query itself are exempt. **keyword-only recall
is the anti-pattern** — lessons are keyed to a `file_glob`/`command_pattern`.

## Capture — Gate Function (before any completion claim)

1. **SELF-CRITIQUE**: any failure, correction, regression, wrong assumption,
   useful surprise, repeated friction, or non-obvious fix? Failing
   tests/lint/typecheck and user/review corrections — yours or anyone's — all count.
2. **CAPTURE** a reusable imperative rule with an effective trigger (else say so):
   `agentsmesh lessons add "<rule>" --topic <id> --trigger-file <glob>`
3. **RECEIPT**: emit `Lesson: captured <id>` or `Lesson: none`.

At least one _effective_ trigger is required or the capture is rejected
(`UNRECALLABLE_LESSON`); prefer `--trigger-file`. No shell → MCP `lessons_query`,
`lessons_add`, `lessons_topics`, `lessons_show`, `lessons_deprecate`. Run
`agentsmesh lessons --help` for every subcommand and flag: query, add, topics, show,
deprecate, merge, untrigger, strip-markers, prune, journal, validate, stats, import-md.

### Rationalization Prevention — these excuses mean STOP

| Excuse | Reality |
| --- | --- |
| "Small edit / I already know this / later" | Query first — skipping recall is a process violation |
| "Nothing reusable here" | You hit a failure/surprise — name it or capture it |
| "My own TDD red, not a real failure" | A red you did not predict IS a lesson |
| "I fixed one site; the twin is obvious" | Capture it — the unfixed twin is what gets missed |
| "Different words, so the rule doesn't apply" | Spirit over letter |

## Lesson gate — before final response

The final response MUST carry the receipt: `Lesson: captured <id>` or `Lesson: none`.
No receipt = task incomplete. Do not capture one-off facts, task summaries, or project
context — only reusable imperative rules with an effective trigger.
