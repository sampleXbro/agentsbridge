/**
 * Maps canonical ignore patterns <-> OpenCode's `permission` path rules.
 *
 * Two config surfaces could plausibly carry "ignore"; only one excludes files:
 *
 *   - `watcher.ignore` — rejected. The live schema types it as a plain glob
 *     array, and the docs scope it to the filesystem watcher ("exclude noisy
 *     directories from file watching"). It never stops a read, so mapping
 *     canonical ignore onto it would advertise exclusion we do not deliver —
 *     a user's `.env` would still be readable.
 *   - `permission` — chosen. `permission.read` / `permission.edit` accept the
 *     granular object form (`PermissionRuleConfig` in the schema) whose keys
 *     match the tool's file path, and `deny` blocks the call outright. That is
 *     real exclusion.
 *
 * Only `read` and `edit` are used: `grep` rules match the search regex and
 * `glob` rules match the glob pattern, not the resolved file path, so deny
 * rules there would be theater.
 *
 * No `"*"` catch-all is emitted. User rules are appended after OpenCode's
 * built-in defaults and the last match wins, so a generated `"*": "allow"`
 * would silently undo OpenCode's own `.env` protection.
 *
 * Patterns use OpenCode wildcards (`*` = any run of characters, `?` = one),
 * not gitignore semantics, so a `*` prefix makes each rule depth-independent.
 * @see https://opencode.ai/config.json
 * @see https://opencode.ai/docs/permissions/
 * @see https://opencode.ai/docs/config
 */

import type { OpenCodePermissionAction } from './permission-map.js';

export type OpenCodeIgnoreRules = Record<string, OpenCodePermissionAction>;

/** Permission keys whose granular rules match a file path. */
export const OPENCODE_IGNORE_PERMISSION_KEYS = ['read', 'edit'] as const;

export interface OpenCodeIgnorePermission {
  read?: OpenCodeIgnoreRules;
  edit?: OpenCodeIgnoreRules;
}

interface IgnoreRule {
  pattern: string;
  action: OpenCodePermissionAction;
}

function toRule(line: string): IgnoreRule | null {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return null;
  const negated = trimmed.startsWith('!');
  const body = (negated ? trimmed.slice(1) : trimmed).replace(/^\/+/, '');
  if (body === '') return null;
  const pattern = `*${body.endsWith('/') ? `${body}*` : body}`;
  return { pattern, action: negated ? 'allow' : 'deny' };
}

export function mapIgnoreToOpenCodePermission(ignore: readonly string[]): OpenCodeIgnorePermission {
  const rules: OpenCodeIgnoreRules = {};
  for (const line of ignore) {
    const rule = toRule(line);
    if (rule) rules[rule.pattern] = rule.action;
  }
  if (Object.keys(rules).length === 0) return {};
  return { read: { ...rules }, edit: { ...rules } };
}

function toIgnoreLine(pattern: string, action: unknown): string | null {
  if (action !== 'deny' && action !== 'allow') return null;
  const body = pattern.startsWith('*') ? pattern.slice(1) : pattern;
  if (body === '') return null;
  return action === 'allow' ? `!${body}` : body;
}

/** Recover canonical ignore patterns from an OpenCode `permission` object. */
export function mapOpenCodePermissionToIgnore(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const permission = value as Record<string, unknown>;
  const lines = new Set<string>();
  for (const key of OPENCODE_IGNORE_PERMISSION_KEYS) {
    const rules = permission[key];
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) continue;
    for (const [pattern, action] of Object.entries(rules)) {
      const line = toIgnoreLine(pattern, action);
      if (line !== null) lines.add(line);
    }
  }
  return [...lines];
}
