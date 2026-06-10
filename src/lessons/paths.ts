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
  /** Optional per-project recall tuning (recallLimit / recallMaxTokens). */
  readonly config: string;
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
    config: join(base, 'config.json'),
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
 * Tier 1 of the lessons contract: the always-on trigger.
 *
 * Lives in the project's root rule (`.agentsmesh/rules/_root.md`) as a managed
 * block, so it reaches every target through canonical rule generation. Universal:
 * only requires the ability to shell-exec the `agentsmesh` CLI. No `Skill` tool,
 * no description-match, no per-target projection.
 *
 * Deliberately minimal — it carries only the BINDING essentials (both commands,
 * the BLOCKING framing, the recall scope, the broad capture scope, the graph
 * path, the MCP fallback). The expansive how-to (full command set, topic
 * workflow, trigger-flag mechanics, the complete rejected-excuse enumeration, and
 * the rebuttal pedagogy) lives in the `lessons` skill (`LESSONS_SKILL_BODY`) so
 * the manual can grow without bloating every target's always-on context.
 *
 * Recall is scoped to MUTATING actions — file edits and state-changing commands —
 * with pure-read commands and the recall query itself explicitly exempt. This
 * removes the infinite regress (recall before the recall command) and the
 * most-flouted "read-only included" clause, cutting guarded actions roughly in
 * half (exploration is read-heavy) while keeping recall where it changes outcomes.
 *
 * Structural shape (heading + intro + Recall block + Capture block + closing)
 * survives generate → import → generate round-trip; only the wording inside each
 * block is tightened for maximum agent compliance.
 */
export const LESSONS_PROCEDURAL_RULE = `## Lessons (BLOCKING: recall before mutating, capture after failing)

Graph \`.agentsmesh/lessons/lessons.json\` is canonical — never hand-edit. Manual: the \`lessons\` skill.

**Recall** — before each file edit and each state-changing command (build/test/install/migrate/git-write): \`agentsmesh lessons query --file <path> --cmd <command>\`, then apply every rule. Pure-read commands (cat/ls/grep/git-log) and the recall query itself are exempt.

**Capture** — right after any failure (a failing test/CI/lint/typecheck, a code review, a user correction, a regression, or a wrong assumption — yours or anyone's): \`agentsmesh lessons add "<rule>" --topic <id> --trigger-file <glob> --evidence <sha|lesson-id>\`.

No shell? Use the \`lessons_query\` / \`lessons_add\` MCP tools.`;
