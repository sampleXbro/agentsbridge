/**
 * `[[hooks]]` -> canonical `hooks.yaml`, merged rather than overwritten.
 *
 * Canonical is shared with every other target, so an import must not delete
 * what Kimi Code simply cannot express. Two things survive a round-trip:
 * events outside Kimi Code's documented list, and prompt-type entries under an
 * event it does support. Membership of the expressible entries still comes
 * from the config file, so removing a hook there does revoke it — but when an
 * entry comes back identical, the richer canonical entry is kept verbatim.
 *
 * Entries stay opaque records rather than `HookEntry`: a canonical hook may
 * carry keys this target never reads, and re-typing would drop them.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { KIMI_CODE_HOOK_EVENTS, isKimiHookTimeout } from './hooks-format.js';

type HookRecord = Record<string, unknown>;
export type CanonicalHookMap = Record<string, HookRecord[]>;

function isRecord(value: unknown): value is HookRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function toCanonicalHooks(entries: readonly HookRecord[]): CanonicalHookMap {
  const hooks: CanonicalHookMap = {};
  for (const entry of entries) {
    const event = str(entry.event);
    const command = str(entry.command);
    if (!event || !command || !KIMI_CODE_HOOK_EVENTS.includes(event)) continue;
    const timeout = typeof entry.timeout === 'number' ? entry.timeout : undefined;
    (hooks[event] ??= []).push({
      matcher: str(entry.matcher) ?? '',
      command,
      ...(timeout === undefined ? {} : { timeout }),
    });
  }
  return hooks;
}

/** Existing canonical hooks, or `{}` when the file is missing or unreadable. */
function parseCanonicalHooks(content: string | null): CanonicalHookMap {
  if (content === null) return {};
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch {
    return {};
  }
  if (!isRecord(parsed)) return {};
  const hooks: CanonicalHookMap = {};
  for (const [event, entries] of Object.entries(parsed)) {
    if (Array.isArray(entries)) hooks[event] = entries.filter(isRecord);
  }
  return hooks;
}

/** `matcher` + `command` identify a hook; `timeout` is the field that can change. */
function sameHook(a: HookRecord, b: HookRecord): boolean {
  return a.matcher === b.matcher && a.command === b.command;
}

/**
 * Canonical keys Kimi Code never reads survive; `timeout` follows the file,
 * because that is the one importable field a user can hand-edit. An absent
 * `timeout` only revokes a canonical one that generation could have written —
 * an out-of-range value was never in `config.toml` to begin with.
 */
function mergeHook(existing: HookRecord, imported: HookRecord): HookRecord {
  const merged = { ...existing };
  if ('timeout' in imported) merged.timeout = imported.timeout;
  else if (isKimiHookTimeout(existing.timeout)) delete merged.timeout;
  return merged;
}

/** Entries Kimi Code has no field for, so their absence is not a revocation. */
function inexpressible(entries: readonly HookRecord[]): HookRecord[] {
  return entries.filter((entry) => entry.type === 'prompt');
}

function mergeEvent(
  existing: readonly HookRecord[],
  imported: readonly HookRecord[],
): HookRecord[] {
  const kept = imported.map((entry) => {
    const match = existing.find((candidate) => sameHook(candidate, entry));
    return match === undefined ? entry : mergeHook(match, entry);
  });
  return [...kept, ...inexpressible(existing)];
}

export function mergeCanonicalHooks(
  existingContent: string | null,
  imported: CanonicalHookMap,
): CanonicalHookMap {
  const existing = parseCanonicalHooks(existingContent);
  const merged: CanonicalHookMap = {};

  for (const [event, entries] of Object.entries(existing)) {
    if (!KIMI_CODE_HOOK_EVENTS.includes(event)) {
      if (entries.length > 0) merged[event] = entries;
      continue;
    }
    const result = mergeEvent(entries, imported[event] ?? []);
    if (result.length > 0) merged[event] = result;
  }

  for (const [event, entries] of Object.entries(imported)) {
    if (!merged[event] && entries.length > 0) merged[event] = entries;
  }
  return merged;
}

export function serializeCanonicalHooks(hooks: CanonicalHookMap): string {
  return stringifyYaml(hooks).trimEnd() + '\n';
}
