import { RECALL_HOOK_COMMAND } from '../lessons/recall-hook-scaffold.js';

/** Hook definition */
export interface HookEntry {
  matcher: string;
  command: string;
  timeout?: number;
  type?: 'command' | 'prompt';
  prompt?: string;
}

/**
 * Hook events that are BEST-EFFORT: injected by agentsmesh tooling (the lessons
 * recall/capture scaffold) as an enhancement, not user-authored content. A target
 * that cannot represent one loses nothing it was asked to keep — the same command
 * is already wired to that target's supported events — so a per-target
 * unmapped-event lint MUST NOT warn about these (that warning would be permanent
 * and unfixable for the user). User-authored hooks under other events still warn.
 *
 * These are the lessons recall/capture scaffold's non-universal events:
 * `UserPromptSubmit` (keyword recall over task text), `PostToolUseFailure` (the
 * capture-on-failure nudge), and `SessionStart` (reset dedup after a compaction).
 * A hook-capable target that can't represent one just misses that recall
 * refinement (recall falls back to the other paths + the always-on paragraph),
 * losing nothing it authored — so it must not be flagged as a dropped hook.
 */
export const BEST_EFFORT_HOOK_EVENTS: ReadonlySet<string> = new Set([
  'UserPromptSubmit',
  'PostToolUseFailure',
  'SessionStart',
]);

/**
 * True only while a best-effort event carries nothing but the injected recall
 * hook. A user-authored command under the same event IS data the target drops,
 * so that event must still be linted like any other unmapped one.
 */
export function isBestEffortHookEvent(event: string, entries: unknown): boolean {
  if (!BEST_EFFORT_HOOK_EVENTS.has(event)) return false;
  if (!Array.isArray(entries)) return true;
  return entries.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { command?: unknown }).command === 'string' &&
      (entry as { command: string }).command.includes(RECALL_HOOK_COMMAND),
  );
}

export interface Hooks {
  PreToolUse?: HookEntry[];
  PostToolUse?: HookEntry[];
  Notification?: HookEntry[];
  UserPromptSubmit?: HookEntry[];
  SubagentStart?: HookEntry[];
  SubagentStop?: HookEntry[];
  [key: string]: HookEntry[] | undefined;
}
