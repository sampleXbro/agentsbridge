# Lessons subsystem

A canonical, target-agnostic mechanism for **lesson recall and capture** —
keeps agents from repeating past mistakes without depending on any
target-specific feature (skills, MDC rules, custom tool calls).

## On-disk layout

Everything lives under `<projectRoot>/.agentsmesh/lessons/`:

```
.agentsmesh/lessons/
├── journal.md              # append-only — point of capture for new lessons
├── index.yaml              # trigger index — topic + file + triggers
├── distill-ledger.yaml     # bullet hash → assigned topic (auto-managed)
├── distill-proposal.md     # transient — drained by distill:apply
└── topics/
    ├── <topic>.md          # one plain markdown file per cluster
    └── ...
```

Topic files are **never projected** to per-target skills folders. The
procedural rule in `_root.md` tells the agent to read them directly using
its standard `Read` tool, and to capture failures via `Edit`/`Write` on the
journal and topic files. No CLI, no package-manager assumption, no external
gate — pure prompt-engineered enforcement that works in every supported
target (Claude Code, Codex CLI, Cline, Roo Code, Cursor, Gemini CLI, Aider,
Goose, etc.) because every agent can read and edit files.

## Enforcement model

The procedural rule in `.agentsmesh/rules/_root.md` (projected to every
target's root) is the single enforcement mechanism. It uses these
prompt-engineering techniques to maximize agent compliance:

- **Imperative voice with MUST / NEVER caps** — frames the rituals as
  non-negotiable, not advisory.
- **Numbered serial protocol** — agents reliably follow ordered steps.
- **Explicit tool names** (`Edit`, `Write`, `Bash`) and concrete file
  paths — no abstraction the agent has to resolve.
- **Pre-empted rationalizations** — common excuses are named and rejected
  inline so the agent cannot reach for them.
- **Anchored consequence** — "process violation", "paid-for failure
  recurs next session", "load-bearing" — visceral framing that triggers
  compliance.
- **Stop-then-act protocol** — "Then — and only then — invoke the tool"
  makes the recall step a hard barrier.

## Public API

Import from `agentsmesh/lessons` (or `src/public/lessons.ts` internally):

```ts
import {
  // Bullet utilities
  hashBullet,
  parseBullets,
  // Schema + types
  parseIndex,
  LessonsIndexSchema,
  type LessonsIndex,
  type LessonsCluster,
  // Runtime matcher
  matchTriggers,
  type ToolEvent,
  // Distill ledger
  loadLedger,
  saveLedger,
  type Ledger,
  // Unified read/write store
  loadLessonsIndex,
  readTriggeredLessons,
  appendLessonToJournal,
  formatLessonBullet,
  type TriggeredLesson,
  type LessonCaptureInput,
  type AppendLessonResult,
  // Scoring
  scoreBullet,
  type ScoredCluster,
  // Paths + templates
  lessonsPaths,
  toRelPath,
  LESSONS_JOURNAL_TEMPLATE,
  LESSONS_INDEX_TEMPLATE,
  LESSONS_PROCEDURAL_RULE,
  type LessonsPaths,
  // Init scaffolder
  scaffoldLessons,
  type ScaffoldLessonsResult,
} from 'agentsmesh/lessons';
```

Everything not re-exported through `src/public/lessons.ts` is internal.

## Subsystem layout

| File | Role |
|---|---|
| `bullet-hash.ts` | Stable 16-char hash of a normalized lesson bullet — keys the ledger. |
| `bullet-parser.ts` | Split a journal into `ParsedBullet[]`. |
| `index-schema.ts` | Zod schema + types for `index.yaml`. Clusters reference topic files by `file:` path; zero-cluster index is valid (fresh init). |
| `matcher.ts` | Runtime trigger matcher (file_globs / command_patterns / keywords → matched clusters). |
| `ledger.ts` | YAML I/O for `distill-ledger.yaml`. |
| `scoring.ts` | Rank clusters for a new bullet during distillation. |
| `store.ts` | High-level file I/O: load the index, read only triggered topic files, and append capture bullets in the canonical journal shape. |
| `paths.ts` | Default file paths under `.agentsmesh/lessons/` + init templates (journal, index, procedural-rule paragraph). |
| `init.ts` | `scaffoldLessons(projectRoot)` — idempotent scaffolder for `agentsmesh init --lessons` (project mode). |

## Topic files: Rules only

Each `topics/<topic>.md` carries **imperative rules only** — no Evidence section.
Verbatim incidents live exclusively in `journal.md`. The split:

- **`topics/<topic>.md`** — what the agent should DO (Rules), loaded on trigger
  match. Small (~0.5–1 KB).
- **`journal.md`** — what HAPPENED (verbatim incidents), never auto-loaded.
  Inspected on demand for audit or to derive new rules.

Distill writes routing decisions into the **ledger only** — never appends to
topic files. If a new journal bullet teaches a new rule, the author edits the
topic's Rules section manually. This keeps topics small and authoritative.

## Adding the subsystem to a project

**Fresh init (one command):**

```bash
agentsmesh init --lessons
```

Creates the canonical `.agentsmesh/` scaffold AND the lessons subsystem in one
shot. Then run `agentsmesh generate` to project the procedural rule to every
target's root file.

**Existing project (retroactive add):**

```bash
agentsmesh init --lessons
agentsmesh generate
```

When `agentsmesh.yaml` already exists, `init --lessons` skips the standard
scaffold and only writes the lessons artifacts + appends the procedural rule
to `.agentsmesh/rules/_root.md`. Idempotent and safe to re-run; never
overwrites existing files.

**Programmatic equivalent** (for custom init flows):

```js
import {
  scaffoldLessons,
  readTriggeredLessons,
  appendLessonToJournal,
} from 'agentsmesh/lessons';

scaffoldLessons(process.cwd());

const lessons = readTriggeredLessons(process.cwd(), {
  kind: 'bash',
  command: "rg 'foo' src",
});

appendLessonToJournal(process.cwd(), {
  heading: 'Example failure',
  whatWentWrong: 'the command failed',
  rootCause: 'a matching lesson was skipped',
  rule: 'read triggered lesson files before running the command',
});
```

**Removal:** `rm -rf .agentsmesh/lessons/` and strip the `## Lessons
(mandatory)` paragraph from `.agentsmesh/rules/_root.md`. One directory, one
paragraph.

**Constraints:**
- Project mode only. `--lessons` combined with `--global` errors out: lessons
  live in the project tree, not the user-level home tree.
- The subsystem starts empty (zero clusters). Topic files accumulate as the
  agent captures real failures and routes them per the procedural rule
  (append to journal, identify topic via `index.yaml`, edit topic Rules if
  the lesson is new).

## Optional helper scripts (internal to agentsmesh)

`scripts/distill-lessons.ts` provides `pnpm distill` / `pnpm distill:apply`
for agentsmesh's own dev workflow — they score new journal bullets against
the index and write/apply a proposal file. They are NOT part of the consumer
contract: the procedural rule never references them, and the lessons
subsystem works end-to-end without them. Consumers can vendor an equivalent
or compose `parseBullets`, `hashBullet`, `scoreBullet`, `loadLedger`,
`saveLedger`, and `matchTriggers` from `agentsmesh/lessons` into their own
routing workflow.

## Notes for future work

- `distill` orchestration currently lives in `scripts/distill-lessons.ts`. When
  a CLI subcommand (`agentsmesh distill` / `agentsmesh distill:apply`) lands,
  extract that orchestration into `src/lessons/distill.ts` so the script and
  the CLI command share one implementation.
- Topic files are plain markdown by convention but the schema only enforces a
  `.md` suffix. Authors may include any markdown structure; `seed-lessons-ledger`
  expects bullets under a `## Evidence` heading prefixed `- L<lineNo>: …`.
