import { MAX_RULE_LENGTH } from './graph-schema.js';
import { recallLessons } from './recall.js';
import type { LessonsQuery } from './query.js';

/**
 * Hook-mode recall: the runtime engine behind a generated PostToolUse hook.
 *
 * A prose contract asks the agent to RUN recall before every mutating action —
 * an extra model turn each time, and only as reliable as the agent's compliance.
 * A PostToolUse hook instead runs recall deterministically AFTER each tool call
 * and injects the matching lessons into the model's context for its NEXT action:
 * zero extra model turn, zero compliance dependence. It is reactive (the first
 * touch of a file is unguarded; every later action is covered), which pairs with
 * the agent revisiting the same files.
 *
 * Only some harnesses can inject context from a tool-call hook (Claude Code /
 * Copilot CLI PostToolUse `additionalContext`). This command is harness-adaptive:
 * it reads the hook's stdin JSON, and on anything it does not recognize — a parse
 * failure, a shape without a file/command, or zero matches — it emits NOTHING. A
 * hook must never break the harness or inject noise, so every failure path is a
 * silent no-op (and the command always exits 0).
 */

interface HookStdin {
  readonly session_id?: unknown;
  readonly tool_input?: { readonly file_path?: unknown; readonly command?: unknown } | null;
}

export interface RecallHookResult {
  /** Raw JSON to write to stdout for the harness, or '' to inject nothing. */
  readonly output: string;
}

const EMPTY: RecallHookResult = { output: '' };

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;

/**
 * Truncate a rule before injecting it into agent context. Capture already blocks
 * over-long rules, but a graph from a cloned third-party repo is untrusted input
 * that may carry a megabyte-scale rule (token exhaustion / context flooding) —
 * this is the last-resort bound for that path.
 */
const TRUNCATION_MARK = ' …[truncated]';
function clampRule(rule: string): string {
  if (rule.length <= MAX_RULE_LENGTH) return rule;
  return rule.slice(0, MAX_RULE_LENGTH - TRUNCATION_MARK.length) + TRUNCATION_MARK;
}

/**
 * Parse a PostToolUse hook stdin payload, recall lessons for the touched file /
 * command, and return the harness's context-injection JSON (or empty output).
 * `session_id` from the harness drives per-session dedup, so a lesson is injected
 * at most once per session even as the agent re-touches the same file.
 */
export async function buildRecallHookOutput(
  rawStdin: string,
  projectRoot: string,
): Promise<RecallHookResult> {
  let parsed: HookStdin;
  try {
    parsed = JSON.parse(rawStdin) as HookStdin;
  } catch {
    return EMPTY;
  }
  const file = str(parsed.tool_input?.file_path);
  const command = str(parsed.tool_input?.command);
  if (file === undefined && command === undefined) return EMPTY;

  const query: LessonsQuery = {
    ...(file !== undefined ? { file } : {}),
    ...(command !== undefined ? { command } : {}),
  };
  const { lessons } = await recallLessons(projectRoot, query, {
    sessionId: str(parsed.session_id),
  });
  if (lessons.length === 0) return EMPTY;

  const target = file ?? command ?? '';
  const bullets = lessons.map((l) => `- ${clampRule(l.lesson.rule)}`).join('\n');
  const additionalContext = `Recalled agentsmesh lessons for ${target} — apply before your next action:\n${bullets}`;
  // Claude Code / Copilot CLI PostToolUse context-injection shape.
  return {
    output: JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext },
    }),
  };
}
