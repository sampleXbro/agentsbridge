/**
 * Deep Agents CLI hooks event-name + shape mapping.
 *
 * `~/.deepagents/hooks.json` is a flat top-level `hooks` array of
 * `{ command: string[], events: string[] }` objects with its own lowercase
 * dotted event vocabulary (docs.langchain.com/oss/javascript/deepagents/code/hooks)
 * — NOT the Claude-style `{ EventName: [{ matcher, hooks: [...] }] }` shape.
 * Canonical hooks use Claude-style PascalCase event names, so both directions
 * are mapped here. Deep Agents has no `matcher` (tool-name filter), no
 * `prompt`-type hooks, and no configurable `timeout` (hardcoded 5s) — none of
 * these are representable and are dropped on generate.
 *
 * Only event pairs with a clear 1:1 semantic match are mapped; the rest
 * (PreToolUse, PostToolUse, Notification, SubagentStart, SubagentStop) have no
 * Deep Agents equivalent and are left unmapped (dropped, lint warning) rather
 * than guessed at — e.g. Deep Agents' `permission.request` / `tool.error` only
 * fire in a subset of PreToolUse/PostToolUse's cases, so mapping those would
 * silently narrow when a canonical hook actually runs.
 */

import { BEST_EFFORT_HOOK_EVENTS } from '../../core/hook-types.js';
import type { HookEntry, Hooks } from '../../core/types.js';
import { getHookText, hasHookText } from '../../core/hook-command.js';

/** Canonical (Claude-style) event name -> Deep Agents dotted event name. */
const CANONICAL_TO_DEEPAGENTS = {
  SessionStart: 'session.start',
  SessionEnd: 'session.end',
  UserPromptSubmit: 'user.prompt',
  Stop: 'task.complete',
  PreCompact: 'context.compact',
} as const;

const DEEPAGENTS_TO_CANONICAL = new Map<string, string>(
  Object.entries(CANONICAL_TO_DEEPAGENTS).map(([canonical, deep]) => [deep, canonical]),
);

export interface DeepagentsHook {
  command: string[];
  events: string[];
}

/**
 * Canonical event names Deep Agents cannot represent — dropped on generate.
 * Excludes BEST_EFFORT_HOOK_EVENTS (agentsmesh-injected recall/capture
 * events): dropping one is not user data loss.
 */
export function unmappedDeepagentsHookEvents(hooks: Hooks): string[] {
  return Object.keys(hooks).filter(
    (event) =>
      Array.isArray(hooks[event]) &&
      (hooks[event] as HookEntry[]).length > 0 &&
      !(event in CANONICAL_TO_DEEPAGENTS) &&
      !BEST_EFFORT_HOOK_EVENTS.has(event),
  );
}

/**
 * Canonical hooks -> Deep Agents `hooks` array. One entry per canonical
 * (event, command-hook) pair — Deep Agents has no per-tool matcher to group
 * commands under. `prompt`-type entries are dropped (Deep Agents only runs
 * literal executables). Commands are wrapped as `["bash", "-c", text]` per
 * the docs' own guidance, preserving shell semantics (pipes, expansion, …).
 */
export function toDeepagentsHooks(hooks: Hooks): DeepagentsHook[] {
  const result: DeepagentsHook[] = [];
  for (const [event, entries] of Object.entries(hooks)) {
    const deepEvent = CANONICAL_TO_DEEPAGENTS[event as keyof typeof CANONICAL_TO_DEEPAGENTS];
    if (!deepEvent || !Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry.type === 'prompt') continue;
      if (!hasHookText(entry)) continue;
      result.push({ command: ['bash', '-c', getHookText(entry)], events: [deepEvent] });
    }
  }
  return result;
}

/** Deep Agents `hooks` array -> canonical hooks (PascalCase events). */
export function deepagentsHooksToCanonical(hooksArray: unknown): Hooks {
  const result: Hooks = {};
  if (!Array.isArray(hooksArray)) return result;
  for (const raw of hooksArray) {
    if (!raw || typeof raw !== 'object') continue;
    const hook = raw as Record<string, unknown>;
    const commandArr = Array.isArray(hook.command)
      ? hook.command.filter((c): c is string => typeof c === 'string')
      : [];
    if (commandArr.length === 0) continue;
    const command =
      commandArr.length === 3 && commandArr[0] === 'bash' && commandArr[1] === '-c'
        ? commandArr[2]!
        : commandArr.join(' ');
    const events = Array.isArray(hook.events)
      ? hook.events.filter((e): e is string => typeof e === 'string')
      : [];
    // Omitted/empty `events` means "receive all events" (docs) — map to every
    // event Deep Agents supports and agentsmesh understands.
    const canonicalEvents =
      events.length > 0
        ? events.map((e) => DEEPAGENTS_TO_CANONICAL.get(e)).filter((e): e is string => !!e)
        : [...DEEPAGENTS_TO_CANONICAL.values()];
    for (const canonicalEvent of canonicalEvents) {
      const entry: HookEntry = { matcher: '', type: 'command', command };
      result[canonicalEvent] = [...(result[canonicalEvent] ?? []), entry];
    }
  }
  return result;
}
