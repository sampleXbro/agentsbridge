import { join, relative, sep } from 'node:path';

/**
 * Default on-disk locations for the lessons subsystem.
 *
 * Canonical store: `<projectRoot>/.agentsmesh/lessons/lessons.json` (the JSON
 * graph). The legacy paths (`journal`, `index`, `topicsDir`) are retained for
 * the one-shot upgrade migrator only; fresh projects never create them.
 */
export interface LessonsPaths {
  /** Directory containing every lessons artifact. */
  readonly base: string;
  /** Canonical JSON graph — the single source of truth. */
  readonly graph: string;
  /** Legacy append-only journal. Used by the migrator only. */
  readonly journal: string;
  /** Legacy YAML trigger index. Used by the migrator only. */
  readonly index: string;
  /** Legacy per-topic Markdown directory. Used by the migrator only. */
  readonly topicsDir: string;
}

const BASE_REL = '.agentsmesh/lessons';

export function lessonsPaths(projectRoot: string): LessonsPaths {
  const base = join(projectRoot, BASE_REL);
  return {
    base,
    graph: join(base, 'lessons.json'),
    journal: join(base, 'journal.md'),
    index: join(base, 'index.yaml'),
    topicsDir: join(base, 'topics'),
  };
}

/**
 * Project-relative path for a given absolute path, normalized to forward
 * slashes for cross-platform consistency in markdown rule files.
 */
export function toRelPath(projectRoot: string, absolute: string): string {
  return relative(projectRoot, absolute).split(sep).join('/');
}

/**
 * Procedural rule paragraph that must live in the project's root rule
 * (`.agentsmesh/rules/_root.md`) for both recall and capture to be enforced.
 *
 * Universal across every agent target: only requires the ability to shell-exec
 * the `agentsmesh` CLI. No `Skill` tool, no description-match, no per-target
 * projection.
 *
 * Structural shape (heading + intro + Recall block + excuses + Capture block +
 * excuses + closing) survives generate → import → generate round-trip; only
 * the wording inside each block is tightened for maximum agent compliance.
 */
export const LESSONS_PROCEDURAL_RULE = `## Lessons (BLOCKING REQUIREMENT — MUST run, no exceptions)

Two shell commands. Skipping either is a process violation; the user will check. The graph at \`.agentsmesh/lessons/lessons.json\` is canonical — NEVER edit by hand.

**Recall — MUST run BEFORE every file edit and every shell command:**

1. Run: \`agentsmesh lessons query --file <path-about-to-edit> --cmd <command-about-to-run>\` (add \`--keyword <text>\` for task matches).
2. Apply EVERY returned rule.
3. Then perform the edit / run the command.

Rejected excuses: *"the edit is small"* → query it. *"I already know this"* → query it. *"I'll do it later"* → no.

**Capture — MUST run IMMEDIATELY after any failure** (test, CI, lint, code review, user correction, regression — anyone's mistake):

1. Run: \`agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <commit-sha|lesson-id>\` (add \`--trigger-cmd <regex>\` / \`--trigger-kw <text>\` as needed).
2. Use \`agentsmesh lessons topics\` to find the topic id; pass \`--new-topic --topic-summary "<one line>"\` for a brand-new area.
3. The CLI writes \`lessons.json\` atomically — capture is one command.

Rejected excuses: *"it wasn't really a failure"* → it was. *"I'll capture it later"* → no. *"no topic fits"* → \`agentsmesh lessons topics\` then \`--new-topic\`.

**These two commands ARE the system. Skip them and the system does not exist.**`;
