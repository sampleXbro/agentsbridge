import { MAX_RULE_LENGTH } from './graph-schema.js';
import { recallLessons } from './recall.js';
import type { LessonsQuery } from './query.js';

/**
 * Hook-mode recall: the runtime engine behind a generated tool-call hook.
 *
 * A prose contract asks the agent to RUN recall before every mutating action —
 * an extra model turn each time, and only as reliable as the agent's compliance.
 * A hook runs recall deterministically and injects the matching lessons into the
 * model's context with zero extra model turn and zero compliance dependence. The
 * command is EVENT-AWARE: it echoes the harness's `hook_event_name`, so the same
 * command serves as a PreToolUse hook that guards the FIRST touch of a file
 * (injecting BEFORE the edit) and/or a PostToolUse hook that covers later actions.
 *
 * Only some harnesses can inject context from a tool-call hook (Claude Code
 * supports PreToolUse + PostToolUse `additionalContext`; some support only Post).
 * This command is harness-adaptive: it reads the hook's stdin JSON, and on
 * anything it does not recognize — a parse failure, a shape without a
 * file/command, or zero matches — it emits NOTHING. A hook must never break the
 * harness or inject noise, so every failure path is a silent no-op (exit 0).
 */

interface HookStdin {
  readonly session_id?: unknown;
  readonly hook_event_name?: unknown;
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

  // Echo the harness's event so the SAME command serves as a PreToolUse first-touch
  // guard (injects BEFORE the edit) or a PostToolUse reactive hook; default to
  // PostToolUse for back-compat and unrecognized events.
  const event = parsed.hook_event_name === 'PreToolUse' ? 'PreToolUse' : 'PostToolUse';

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
  // Claude Code / Copilot CLI tool-call context-injection shape (Pre or Post).
  return {
    output: JSON.stringify({
      hookSpecificOutput: { hookEventName: event, additionalContext },
    }),
  };
}
