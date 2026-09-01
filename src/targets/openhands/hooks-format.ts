/**
 * Canonical hooks -> `.openhands/hooks.json`.
 *
 * `HookConfig` sets `model_config extra="forbid"`, so only the six verified
 * event fields are ever written and nothing else goes in the document.
 *
 * `HookType.COMMAND` and `HookType.PROMPT` both map to canonical `HookEntry`;
 * `HookType.AGENT` has no canonical form at all. `normalizeOpenhandsHookDocument`
 * is the shared reader for every on-disk shape (see hooks-import.ts for the
 * shapes and merge.ts for the write-side carry-over).
 */

import type { HookEntry, Hooks } from '../../core/types.js';
import { getHookCommand, getHookPrompt } from '../../core/hook-command.js';

/** Canonical event names OpenHands can represent, in document key order. */
export const OPENHANDS_HOOK_EVENTS: readonly string[] = [
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
];

const CANONICAL_TO_OPENHANDS: Readonly<Record<string, string>> = {
  PreToolUse: 'pre_tool_use',
  PostToolUse: 'post_tool_use',
  UserPromptSubmit: 'user_prompt_submit',
  SessionStart: 'session_start',
  SessionEnd: 'session_end',
  Stop: 'stop',
};

export const OPENHANDS_TO_CANONICAL: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(CANONICAL_TO_OPENHANDS).map(([canonical, native]) => [native, canonical]),
);

/** `HOOK_EVENT_FIELDS` (hooks/config.py), in document key order. */
export const OPENHANDS_HOOK_EVENT_FIELDS: readonly string[] = Object.values(CANONICAL_TO_OPENHANDS);

/** Handler keys agentsmesh derives from canonical; anything else is carried over. */
export const OPENHANDS_OWNED_HANDLER_KEYS: readonly string[] = [
  'type',
  'command',
  'prompt',
  'timeout',
];

export interface OpenhandsHookGroup {
  matcher: string;
  hooks: Record<string, unknown>[];
}

/** Mirrors `_pascal_to_snake`: leaves an already snake_case field name alone. */
function pascalToSnake(name: string): string {
  return name.replace(/(?!^)([A-Z])/g, '_$1').toLowerCase();
}

/**
 * The `HOOK_EVENT_FIELDS` entry an event key normalises to, or `null` when
 * `HookConfig` would reject it (`extra="forbid"`, or `Unknown event type`).
 */
export function openhandsHookEventField(name: string): string | null {
  const field = pascalToSnake(name);
  return OPENHANDS_HOOK_EVENT_FIELDS.includes(field) ? field : null;
}

function buildHandler(entry: HookEntry): Record<string, unknown> | null {
  const handler: Record<string, unknown> = {};
  if (entry.type === 'prompt') {
    const prompt = getHookPrompt(entry);
    // `_validate_type_fields` requires `prompt` and forbids `command` here.
    if (!prompt) return null;
    handler.type = 'prompt';
    handler.prompt = prompt;
  } else {
    const command = getHookCommand(entry);
    if (!command) return null;
    handler.type = 'command';
    handler.command = command;
  }
  if (entry.timeout !== undefined) handler.timeout = entry.timeout;
  return handler;
}

function handlerGroups(entries: HookEntry[]): OpenhandsHookGroup[] {
  const groups: OpenhandsHookGroup[] = [];
  for (const entry of entries) {
    const handler = buildHandler(entry);
    if (handler !== null) groups.push({ matcher: entry.matcher, hooks: [handler] });
  }
  return groups;
}

/** The whole `.openhands/hooks.json` document, or `null` when nothing maps. */
export function buildOpenhandsHooks(hooks: Hooks | null): Record<string, unknown> | null {
  if (!hooks) return null;
  const document: Record<string, unknown> = {};
  for (const event of OPENHANDS_HOOK_EVENTS) {
    const entries = hooks[event];
    if (!Array.isArray(entries)) continue;
    const groups = handlerGroups(entries);
    if (groups.length > 0) document[CANONICAL_TO_OPENHANDS[event]!] = groups;
  }
  return Object.keys(document).length > 0 ? document : null;
}

/** Supported events with an entry OpenHands cannot run (no command, no prompt). */
export function droppedHookEntryEvents(hooks: Hooks | null): string[] {
  if (!hooks) return [];
  return OPENHANDS_HOOK_EVENTS.filter((event) => {
    const entries = hooks[event];
    if (!Array.isArray(entries)) return false;
    return entries.some((entry) => buildHandler(entry) === null);
  });
}

export function asHookRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Every accepted on-disk shape reduced to snake_case field keys, or `null` when
 * the document is not a hook config at all. Unknown keys are dropped rather than
 * raised on, so one bad key never costs the user the rest of the file.
 */
export function normalizeOpenhandsHookDocument(value: unknown): Record<string, unknown> | null {
  let record = asHookRecord(value);
  if (!record) return null;
  if ('hooks' in record) {
    record = asHookRecord(record.hooks);
    if (!record) return null;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(record)) {
    const field = openhandsHookEventField(key);
    if (field === null) continue;
    const seen = normalized[field];
    normalized[field] =
      Array.isArray(seen) && Array.isArray(raw) ? [...seen, ...raw] : (seen ?? raw);
  }
  return normalized;
}
