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
procedural rule in `_root.md` tells the agent to read them directly. Universal
across every supported target — Claude Code, Codex CLI, Cline, Roo Code,
Cursor, Gemini CLI, Aider, Goose, etc. — because every agent can read a file.

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
| `paths.ts` | Default file paths under `.agentsmesh/lessons/` + init templates (journal, index, procedural-rule paragraph). |
| `init.ts` | `scaffoldLessons(projectRoot)` — idempotent scaffolder for future `agentsmesh init --lessons` (project mode). |

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

## CLI — the only interface consumers need

Three subcommands, all shipped inside the `agentsmesh` binary. No scripts
to copy, no package-manager assumptions, no third-party tooling:

```bash
agentsmesh distill            # propose routing for unrouted journal bullets
agentsmesh distill --apply    # record reviewed decisions in the ledger
agentsmesh distill --check    # assert every bullet is routed; exits 1 if not
```

## Hard guarantee: `agentsmesh distill --check`

The procedural rule in `_root.md` is a *soft contract* — an agent can ignore
it. The single hard guarantee in the subsystem is `agentsmesh distill --check`:

- Hashes every bullet in `journal.md`.
- Asserts every hash is in `distill-ledger.yaml` (routed to a topic or
  explicitly `skip`).
- Exits non-zero if any bullet is unrouted, listing each by line + preview.

Wire it as a pre-commit hook (husky / lefthook / simple-git-hooks / plain
`.git/hooks`) or a CI step. A failed check forces the developer or agent to
distill the bullet (or explicitly mark it `skip`) before the commit lands.
Captured lessons can no longer be silently dropped.

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
import { scaffoldLessons } from 'agentsmesh/lessons';
const result = scaffoldLessons(process.cwd());
```

**Removal:** `rm -rf .agentsmesh/lessons/` and strip the `## Lessons
(mandatory)` paragraph from `.agentsmesh/rules/_root.md`. One directory, one
paragraph.

**Constraints:**
- Project mode only. `--lessons` combined with `--global` errors out: lessons
  live in the project tree, not the user-level home tree.
- The subsystem starts empty (zero clusters). Topic files accumulate as the
  agent captures real failures and runs `pnpm distill` → `pnpm distill:apply`.

## Notes for future work

- `distill` orchestration currently lives in `scripts/distill-lessons.ts`. When
  a CLI subcommand (`agentsmesh distill` / `agentsmesh distill:apply`) lands,
  extract that orchestration into `src/lessons/distill.ts` so the script and
  the CLI command share one implementation.
- Topic files are plain markdown by convention but the schema only enforces a
  `.md` suffix. Authors may include any markdown structure; `seed-lessons-ledger`
  expects bullets under a `## Evidence` heading prefixed `- L<lineNo>: …`.
