/**
 * Canonical hooks -> Kimi Code `[[hooks]]` entries in `~/.kimi-code/config.toml`.
 *
 * The `[[hooks]]` schema is strict: an unknown field on ANY entry aborts the
 * whole config load, taking the provider credentials in the same file with it.
 * So this module is a whitelist in both directions — only `event`, `matcher`,
 * `command` and `timeout` are ever written, only documented event names pass,
 * and a timeout outside the documented 1–600s range is dropped rather than
 * clamped to a value the user never chose. Everything refused is reported by
 * `unmappedHookEntries` so `lint.ts` can name it.
 */

import type { Hooks } from '../../core/types.js';

/** Documented event triggers (moonshotai.github.io/kimi-code/en/customization/hooks). */
export const KIMI_CODE_HOOK_EVENTS: readonly string[] = [
  'UserPromptSubmit',
  'UserPromptQueued',
  'PreToolUse',
  'Stop',
  'TurnStarted',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionResult',
  'SessionStart',
  'SessionEnd',
  'SessionHeartbeat',
  'SubagentStart',
  'SubagentStop',
  'TaskStarted',
  'StopFailure',
  'Interrupt',
  'PreCompact',
  'PostCompact',
  'Notification',
];

const MIN_TIMEOUT_SECONDS = 1;
const MAX_TIMEOUT_SECONDS = 600;

export interface KimiHookEntry {
  readonly event: string;
  readonly matcher?: string;
  readonly command: string;
  readonly timeout?: number;
}

export interface UnmappedHooks {
  /** Events Kimi Code does not define. */
  readonly events: string[];
  /** Events holding prompt-type hooks, which Kimi Code cannot express. */
  readonly promptEvents: string[];
  /** Events whose timeout falls outside the documented 1–600s range. */
  readonly timeouts: string[];
}

function isSupportedEvent(event: string): boolean {
  return KIMI_CODE_HOOK_EVENTS.includes(event);
}

/** A timeout Kimi Code accepts, so one generation could have written. */
export function isKimiHookTimeout(timeout: unknown): boolean {
  return (
    typeof timeout === 'number' &&
    Number.isInteger(timeout) &&
    timeout >= MIN_TIMEOUT_SECONDS &&
    timeout <= MAX_TIMEOUT_SECONDS
  );
}

export function buildKimiHookEntries(hooks: Hooks | null): KimiHookEntry[] {
  if (!hooks) return [];
  const entries: KimiHookEntry[] = [];
  for (const [event, list] of Object.entries(hooks)) {
    if (!Array.isArray(list) || !isSupportedEvent(event)) continue;
    for (const entry of list) {
      if (entry.type === 'prompt' || !entry.command) continue;
      const emitted: KimiHookEntry = {
        event,
        ...(entry.matcher ? { matcher: entry.matcher } : {}),
        command: entry.command,
        ...(isKimiHookTimeout(entry.timeout) ? { timeout: entry.timeout } : {}),
      };
      entries.push(emitted);
    }
  }
  return entries;
}

/** Everything `buildKimiHookEntries` refused, grouped so lint can name it. */
export function unmappedHookEntries(hooks: Hooks | null): UnmappedHooks {
  const events: string[] = [];
  const promptEvents: string[] = [];
  const timeouts: string[] = [];
  for (const [event, list] of Object.entries(hooks ?? {})) {
    if (!Array.isArray(list) || list.length === 0) continue;
    if (!isSupportedEvent(event)) {
      events.push(event);
      continue;
    }
    if (list.some((entry) => entry.type === 'prompt')) promptEvents.push(event);
    if (list.some((entry) => entry.timeout !== undefined && !isKimiHookTimeout(entry.timeout))) {
      timeouts.push(event);
    }
  }
  return { events, promptEvents, timeouts };
}
