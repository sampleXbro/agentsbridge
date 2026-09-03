/**
 * Event-scoped merge for `~/.deepagents/hooks.json`.
 *
 * The file is the tool's ONLY documented hooks location, so it is the file users
 * are told to hand-edit — and its `hooks` array is flat, with no key to scope
 * ownership by. Ownership is therefore per EVENT: agentsmesh projects into the
 * five events `hooks-format.ts` maps, so an entry bound only to those events is
 * agentsmesh's and is replaced (that is how a revoked canonical hook stops
 * running), while an entry touching any other event is the user's and survives.
 *
 * That is what keeps hooks on `permission.request` and `tool.error` — events
 * with no canonical equivalent, so they can be neither generated nor imported
 * back, and losing one loses it for good. Every other top-level key of the file
 * survives too.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { DEEPAGENTS_MANAGED_EVENTS } from './hooks-format.js';
import { DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE } from './constants.js';

type Json = Record<string, unknown>;

function parseJsonObject(raw: string): Json | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Json)
      : null;
  } catch {
    return null;
  }
}

/** True when every event this entry binds is one agentsmesh generates. */
function isManagedEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  const events = (entry as Json).events;
  if (!Array.isArray(events) || events.length === 0) return false;
  return events.every((event) => typeof event === 'string' && DEEPAGENTS_MANAGED_EVENTS.has(event));
}

/**
 * @returns Merged JSON, or `newContent` when there is no parsable base to keep.
 */
export function mergeDeepagentsHooks(base: string | null, newContent: string): string {
  const baseRoot = base === null ? null : parseJsonObject(base);
  if (baseRoot === null) return newContent;
  const incoming = parseJsonObject(newContent);
  if (incoming === null) return base!;

  const kept = Array.isArray(baseRoot.hooks)
    ? baseRoot.hooks.filter((entry) => !isManagedEntry(entry))
    : [];
  const generated = Array.isArray(incoming.hooks) ? incoming.hooks : [];
  return JSON.stringify({ ...baseRoot, hooks: [...kept, ...generated] }, null, 2);
}

export const mergeDeepagentsHooksJson: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) =>
  resolvedPath === DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE
    ? mergeDeepagentsHooks(pending?.content ?? existing, newContent)
    : null;
