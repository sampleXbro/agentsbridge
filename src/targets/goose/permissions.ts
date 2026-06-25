/**
 * Goose tool permissions live in the global `~/.config/goose/permission.yaml`
 * (Open-source Goose, `crates/goose/src/config/permission.rs`): a YAML map keyed
 * by category (`user`, `smart_approve`, …) where each category is a
 * `PermissionConfig { always_allow, ask_before, never_allow }` of tool-name
 * lists. AgentsMesh owns the `user` category and maps it to canonical
 * permissions as allow↔always_allow, ask↔ask_before, deny↔never_allow.
 *
 * The `smart_approve` category is a runtime cache Goose maintains, so generation
 * merge-preserves every non-`user` category from the existing file. There is no
 * project-level permission file, so this is global-only.
 */

import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import type { Permissions } from '../../core/canonical-types.js';
import { toStringArray } from '../import/shared-import-helpers.js';

interface PermissionConfig {
  always_allow?: string[];
  ask_before?: string[];
  never_allow?: string[];
}

function parseYamlObject(content: string | null): Record<string, unknown> {
  if (content === null) return {};
  try {
    const parsed = parseYaml(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through to empty
  }
  return {};
}

export function serializeGoosePermissions(
  permissions: Permissions | null,
  existingContent: string | null,
): string | null {
  const allow = permissions?.allow ?? [];
  const ask = permissions?.ask ?? [];
  const deny = permissions?.deny ?? [];
  if (allow.length === 0 && ask.length === 0 && deny.length === 0) return null;

  const user: PermissionConfig = {};
  if (allow.length > 0) user.always_allow = allow;
  if (ask.length > 0) user.ask_before = ask;
  if (deny.length > 0) user.never_allow = deny;

  const root = parseYamlObject(existingContent);
  root.user = user;
  return stringifyYaml(root).trimEnd() + '\n';
}

export function parseGoosePermissions(content: string): Permissions | null {
  const root = parseYamlObject(content);
  const user = root.user;
  if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
  const block = user as Record<string, unknown>;
  const allow = toStringArray(block.always_allow);
  const ask = toStringArray(block.ask_before);
  const deny = toStringArray(block.never_allow);
  if (allow.length === 0 && ask.length === 0 && deny.length === 0) return null;
  const permissions: Permissions = { allow, deny };
  if (ask.length > 0) permissions.ask = ask;
  return permissions;
}
