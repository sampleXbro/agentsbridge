/**
 * Canonical permissions -> Kimi Code `[[permission.rules]]` entries.
 *
 * `PermissionRuleSchema` runs every `pattern` through `parsePermissionPattern`
 * and refuses the config that carries a failing one, so patterns are checked
 * here before they reach the file and refused ones are reported for lint. The
 * check is the tool's, not a stricter one of our own.
 *
 * `scope` is deliberately omitted: the rules are written to the user-level
 * config, which is already the `user` scope, and every field we skip is one
 * fewer chance to trip the schema.
 */

import type { Permissions } from '../../core/types.js';

export type KimiPermissionDecision = 'allow' | 'deny' | 'ask';

export interface KimiPermissionRule {
  readonly decision: KimiPermissionDecision;
  readonly pattern: string;
}

/**
 * Mirrors `parsePattern` exactly. It throws on three inputs only — an empty
 * (or whitespace-only) string, a `(` with no closing `)`, and an empty tool
 * name before the `(`. Everything else parses: tool names go through
 * `picomatch.isMatch`, so `mcp__github__*` and a bare `*` are legal, and
 * `Tool()` is a bare tool match. Anything stricter would drop rules the tool
 * accepts, silently un-enforcing a `deny`.
 */
export function isValidKimiPermissionPattern(pattern: string): boolean {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) return false;

  const open = trimmed.indexOf('(');
  if (open === -1) return true;
  return trimmed.endsWith(')') && open > 0;
}

/**
 * Emission order. Kimi Code registers deny, ask and allow as three separate
 * policies, so file order never decides across decisions; grouping by decision
 * just keeps the generated file readable and stable.
 */
const DECISION_ORDER: readonly {
  readonly decision: KimiPermissionDecision;
  readonly key: keyof Permissions;
}[] = [
  { decision: 'allow', key: 'allow' },
  { decision: 'ask', key: 'ask' },
  { decision: 'deny', key: 'deny' },
];

function listOf(permissions: Permissions, key: keyof Permissions): readonly string[] {
  return permissions[key] ?? [];
}

export function buildKimiPermissionRules(permissions: Permissions | null): KimiPermissionRule[] {
  if (!permissions) return [];
  const rules: KimiPermissionRule[] = [];
  for (const { decision, key } of DECISION_ORDER) {
    for (const pattern of listOf(permissions, key)) {
      if (isValidKimiPermissionPattern(pattern)) rules.push({ decision, pattern });
    }
  }
  return rules;
}

/** Canonical entries Kimi Code cannot express, in canonical order. */
export function unmappedPermissionPatterns(permissions: Permissions | null): string[] {
  if (!permissions) return [];
  return (['allow', 'deny', 'ask'] as const).flatMap((key) =>
    listOf(permissions, key).filter((pattern) => !isValidKimiPermissionPattern(pattern)),
  );
}
