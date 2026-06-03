---
'agentsmesh': minor
---

Add `agentsmesh init --lessons` and a new `agentsmesh/lessons` public API for
the lessons recall + capture subsystem.

The subsystem keeps agents from repeating past mistakes via a procedural rule
that lives in every target's root file: before any edit or command, scan
`.agentsmesh/lessons/index.yaml` and read every matched
`.agentsmesh/lessons/topics/<topic>.md`; after any failure, append to
`.agentsmesh/lessons/journal.md`. The optional repo-local `pnpm distill` /
`pnpm distill:apply` scripts can help maintain AgentsMesh's own topic routing,
but the generated rule does not require package-manager-specific tooling.

**Using it:**

- **Fresh init:** `agentsmesh init --lessons` — creates the canonical scaffold
  AND the lessons subsystem in one command.
- **Retroactive add (existing project):** the same `agentsmesh init --lessons`
  — when `agentsmesh.yaml` already exists, init only scaffolds the lessons
  artifacts and appends the procedural rule to `_root.md`. Idempotent.
- After either flow, run `agentsmesh generate` to project the procedural rule
  to every target's root file.

**Public API** (importable from `agentsmesh/lessons`):

- `scaffoldLessons(projectRoot)` — idempotent scaffolder used internally by
  `init --lessons`; reusable from custom tooling.
- `loadLessonsIndex(projectRoot)`, `readTriggeredLessons(projectRoot, event)`,
  `appendLessonToJournal(projectRoot, input)`, and `formatLessonBullet(input)` —
  one high-level, target-agnostic read/write layer for integrations that should
  not hand-roll filesystem access.
- `lessonsPaths(projectRoot)`, `LESSONS_PROCEDURAL_RULE`,
  `LESSONS_JOURNAL_TEMPLATE`, `LESSONS_INDEX_TEMPLATE` — paths and templates.
- `parseIndex`, `LessonsIndexSchema`, `matchTriggers`, `scoreBullet`,
  `loadLedger`, `saveLedger`, `hashBullet`, `parseBullets` — building blocks
  for downstream tooling (custom distillers, recall hooks, IDE plugins).

**Universal across every target.** The subsystem uses plain markdown files
read via standard file I/O — no `Skill` tool, no description-match, no
per-target projection. Works in Claude Code, Codex CLI, Cline, Roo Code,
Cursor, Gemini CLI, Aider, Goose, and every other supported harness.

**Linter integration:** `agentsmesh lint` now validates the lessons subsystem
when present — checks that `index.yaml` parses, topic files referenced in the
index exist, and the journal file is well-formed.

**Constraints:**
- `--lessons` is project-mode only. Combining with `--global` errors out.
- Removal: `rm -rf .agentsmesh/lessons/` and strip the `## Lessons` paragraph
  from `.agentsmesh/rules/_root.md`.
