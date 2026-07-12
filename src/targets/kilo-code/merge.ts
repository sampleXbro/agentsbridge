/**
 * Merge helper for `kilo.jsonc` / `.config/kilo/kilo.jsonc`.
 *
 * When a project already has a kilo.jsonc (e.g. with custom keys), agentsmesh
 * overlays only the keys it manages (`permission`, plus `instructions` and
 * `mcp` at global scope — see global-settings.ts) rather than overwriting the
 * whole file. Multiple generator passes write to the SAME path at global
 * scope (permissions via generatePermissionsFeature, instructions/mcp via
 * emitScopedSettings), so `base` always prefers `pending?.content` over
 * `existing` — each subsequent write builds on the previous one in this run.
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
  if (overlay.instructions !== undefined) parsed.instructions = overlay.instructions;
  if (overlay.mcp !== undefined) parsed.mcp = overlay.mcp;
  return JSON.stringify(parsed, null, 2);
};
