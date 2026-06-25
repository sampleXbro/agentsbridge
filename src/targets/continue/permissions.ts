/**
 * Continue's personal permissions file (`~/.continue/permissions.yaml`) uses
 * three top-level keys — `allow`, `ask`, `exclude` — each an array of
 * tool-matcher pattern strings (e.g. `Read(*)` or a `Write(...)` glob). This
 * maps to canonical permissions as allow↔allow, ask↔ask, and exclude↔deny.
 *
 * Continue only reads this at the personal (global) tier today; project-level
 * permissions are explicitly "not implemented yet" upstream, so generation and
 * import are global-only.
 */

import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import type { Permissions } from '../../core/canonical-types.js';
import { toStringArray } from '../import/shared-import-helpers.js';

export function serializeContinuePermissions(permissions: Permissions | null): string | null {
  if (!permissions) return null;
  const allow = permissions.allow ?? [];
  const ask = permissions.ask ?? [];
  const exclude = permissions.deny ?? [];
  if (allow.length === 0 && ask.length === 0 && exclude.length === 0) return null;
  const out: Record<string, string[]> = {};
  if (allow.length > 0) out.allow = allow;
  if (ask.length > 0) out.ask = ask;
  if (exclude.length > 0) out.exclude = exclude;
  return stringifyYaml(out).trimEnd() + '\n';
}

export function parseContinuePermissions(content: string): Permissions | null {
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const allow = toStringArray(record.allow);
  const ask = toStringArray(record.ask);
  const deny = toStringArray(record.exclude);
  if (allow.length === 0 && ask.length === 0 && deny.length === 0) return null;
  const permissions: Permissions = { allow, deny };
  if (ask.length > 0) permissions.ask = ask;
  return permissions;
}
