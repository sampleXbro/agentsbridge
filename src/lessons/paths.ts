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
 * the BLOCKING framing, the recall scope including read-only, the broad capture
 * scope, the graph path, the MCP fallback). The expansive how-to (full command
 * set, topic workflow, trigger-flag mechanics, the complete rejected-excuse
 * enumeration) lives in the `lessons` skill (`LESSONS_SKILL_BODY`) so the manual
 * can grow without bloating every target's always-on context.
 *
 * Structural shape (heading + intro + Recall block + Capture block + closing)
 * survives generate → import → generate round-trip; only the wording inside each
 * block is tightened for maximum agent compliance.
 */
export const LESSONS_PROCEDURAL_RULE = `## Lessons (BLOCKING REQUIREMENT — MUST run both, no exceptions; the user will check)

The graph \`.agentsmesh/lessons/lessons.json\` is canonical — never hand-edit. Full manual: the \`lessons\` skill.

**Recall — before every file edit and every shell command, read-only included (git/ls/cat/test runs still count):** run \`agentsmesh lessons query --file <path-about-to-edit> --cmd <command-about-to-run>\` (add \`--keyword <text>\` to match by task), then apply every rule returned. Pass the real \`--file\`/\`--cmd\`: a predicate-less query is rejected, and keyword-only recall misses most lessons. Skipping recall is a process violation.

**Capture — immediately after any failure, not limited to red tests** (a failing CI/lint/typecheck, a code review, a user correction, a regression, or a wrong assumption — yours or anyone's): run \`agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <sha|lesson-id>\` — one trigger minimum (prefer \`--trigger-file\`); new area adds \`--new-topic --topic-summary "<line>"\`.

No shell? Use the \`lessons_query\` / \`lessons_add\` MCP tools. Skip these and the system does not exist.`;
