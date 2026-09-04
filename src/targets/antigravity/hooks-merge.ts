/**
 * `.agents/hooks.json` / `~/.gemini/config/hooks.json` is the user's hooks file
 * (antigravity.google/docs/hooks). Its TOP-LEVEL keys are user-chosen handler
 * NAMES mapping to an object — `{"my-hook": {enabled, PreToolUse: [...]}}` —
 * while agentsmesh writes canonical event names mapping to an ARRAY. There is
 * no hooks importer for Antigravity, so a handler overwritten here is gone for
 * good.
 *
 * That shape difference is the ownership line, so no shared key-list merger
 * fits: the owned key set is not fixed. agentsmesh owns exactly the keys whose
 * value is an array — the ones it writes — and keeps every named handler.
 * Revocation still works: an owned key the run no longer emits is dropped.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { ANTIGRAVITY_HOOKS_FILE, ANTIGRAVITY_GLOBAL_HOOKS_FILE } from './constants.js';

const HOOKS_PATHS = [ANTIGRAVITY_HOOKS_FILE, ANTIGRAVITY_GLOBAL_HOOKS_FILE];

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** @returns Merged JSON, the base verbatim when it is not a JSON object, or null. */
export function mergeAntigravityHooksContent(
  base: string | null,
  newContent: string,
): string | null {
  if (base === null || base.trim() === '') return null;
  const incoming = parseJsonObject(newContent);
  if (incoming === null) return null;
  const baseObject = parseJsonObject(base);
  if (baseObject === null) return base;

  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(baseObject)) {
    if (!Array.isArray(value)) merged[key] = value;
  }
  return JSON.stringify({ ...merged, ...incoming }, null, 2);
}

export const mergeAntigravityHooks: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) =>
  HOOKS_PATHS.includes(resolvedPath)
    ? mergeAntigravityHooksContent(pending?.content ?? existing, newContent)
    : null;
