/**
 * Merge helper for `kilo.jsonc` / `.config/kilo/kilo.jsonc`.
 *
 * When a project already has a kilo.jsonc (e.g. with custom keys), agentsmesh
 * overlays only the `permission` section rather than overwriting the whole
 * file.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { KILO_CONFIG_FILE, KILO_GLOBAL_CONFIG_FILE } from './constants.js';

export const mergeKiloConfig: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) => {
  if (resolvedPath !== KILO_CONFIG_FILE && resolvedPath !== KILO_GLOBAL_CONFIG_FILE) return null;
  const base = pending?.content ?? existing;
  if (base === null) return newContent;
  let parsed: Record<string, unknown>;
  try {
    const p: unknown = JSON.parse(base);
    parsed =
      p !== null && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  const incoming: unknown = JSON.parse(newContent);
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) return base;
  const overlay = incoming as Record<string, unknown>;
  if (overlay.permission !== undefined) parsed.permission = overlay.permission;
  return JSON.stringify(parsed, null, 2);
};
