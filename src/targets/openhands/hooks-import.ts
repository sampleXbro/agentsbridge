/**
 * `.openhands/hooks.json` -> canonical hooks.
 *
 * Reading is deliberately wider than writing, because `_normalize_hooks_input`
 * (hooks/config.py) accepts three shapes agentsmesh never writes:
 *   - the legacy `{"hooks": {…}}` wrapper (extra top-level keys are ignored),
 *   - PascalCase event keys (`PreToolUse`) as well as the field names,
 *   - handlers with no `type`, because `HookDefinition.type` defaults to
 *     `HookType.COMMAND` — the form every example in the docs uses.
 * The SDK raises on a duplicated event (both casings); agentsmesh merges the two
 * arrays instead, so import keeps everything and the next generate rewrites the
 * file in the single valid casing.
 *
 * `HookType.AGENT` has no canonical representation, so it is skipped here and
 * carried over untouched on write (merge.ts).
 */

import type { HookEntry, Hooks } from '../../core/types.js';
import {
  OPENHANDS_TO_CANONICAL,
  asHookRecord,
  normalizeOpenhandsHookDocument,
} from './hooks-format.js';

function parseHandler(raw: unknown, matcher: string): HookEntry | null {
  const handler = asHookRecord(raw);
  if (!handler) return null;
  const type = handler.type ?? 'command';
  const timeout = typeof handler.timeout === 'number' ? handler.timeout : undefined;

  let entry: HookEntry;
  if (type === 'command' && typeof handler.command === 'string' && handler.command.length > 0) {
    entry = { matcher, command: handler.command, type: 'command' };
  } else if (type === 'prompt' && typeof handler.prompt === 'string' && handler.prompt.length > 0) {
    entry = { matcher, command: '', type: 'prompt', prompt: handler.prompt };
  } else {
    return null;
  }
  if (timeout !== undefined) entry.timeout = timeout;
  return entry;
}

function parseGroup(group: unknown, into: HookEntry[]): void {
  const record = asHookRecord(group);
  if (!record || !Array.isArray(record.hooks)) return;
  const matcher = typeof record.matcher === 'string' ? record.matcher : '*';
  for (const raw of record.hooks) {
    const entry = parseHandler(raw, matcher);
    if (entry !== null) into.push(entry);
  }
}

/** Parse a `.openhands/hooks.json` document back to canonical hooks. */
export function parseOpenhandsHooks(content: string): Hooks | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  const document = normalizeOpenhandsHookDocument(parsed);
  if (!document) return null;

  const hooks: Hooks = {};
  for (const [field, groups] of Object.entries(document)) {
    if (!Array.isArray(groups)) continue;
    const entries: HookEntry[] = [];
    for (const group of groups) parseGroup(group, entries);
    if (entries.length > 0) hooks[OPENHANDS_TO_CANONICAL[field]!] = entries;
  }
  return Object.keys(hooks).length > 0 ? hooks : null;
}
