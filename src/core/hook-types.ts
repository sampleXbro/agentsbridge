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

export interface Hooks {
  PreToolUse?: HookEntry[];
  PostToolUse?: HookEntry[];
  Notification?: HookEntry[];
  UserPromptSubmit?: HookEntry[];
  SubagentStart?: HookEntry[];
  SubagentStop?: HookEntry[];
  [key: string]: HookEntry[] | undefined;
}
