/**
 * Parse .agentsmesh/permissions.yaml into Permissions.
 */

import { parse as parseYaml } from 'yaml';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import type { Permissions } from '../../core/types.js';

function ensureStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((x): x is string => typeof x === 'string');
}

/**
 * Parse permissions.yaml at the given path.
 * @param permissionsPath - Absolute path to .agentsmesh/permissions.yaml
 * @returns Permissions or null if file missing or malformed
 */
export async function parsePermissions(permissionsPath: string): Promise<Permissions | null> {
  const content = await readFileSafe(permissionsPath);
  if (content === null) return null;
  if (!content.trim()) return { allow: [], deny: [], ask: [] };
  let parsed: unknown;
  try {
    parsed = parseYaml(content) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const allow = ensureStringArray(obj.allow);
  const deny = ensureStringArray(obj.deny);
  const ask = ensureStringArray(obj.ask);
  return { allow, deny, ask };
}
