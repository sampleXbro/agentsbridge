/**
 * Several Kiro agent profiles -> one canonical rule set.
 *
 * Canonical permissions are project-wide; Kiro's profile permissions are
 * per agent. When profiles disagree there is no lossless collapse, so the
 * collapse is chosen to be the one that cannot widen anybody's grant under
 * Kiro's documented "deny > ask > allow" evaluation:
 *
 *   - deny is the UNION — a deny any profile carries is kept, so no agent
 *     silently gains something one of them refused;
 *   - allow and ask are the INTERSECTION — a grant only one profile carries is
 *     dropped, so no agent gains a grant it never had.
 *
 * A union of allows was the obvious reading and is exactly wrong: regeneration
 * writes the merged set back into EVERY profile, so one profile's `shell deny`
 * plus another's `shell allow` would leave both agents denied while canonical
 * claimed the shell was allowed.
 */

import { KIRO_EFFECTS, kiroRuleKey, type KiroPermissionRule } from './permissions-format.js';

function keysOf(rules: readonly KiroPermissionRule[]): Set<string> {
  return new Set(rules.map((rule) => kiroRuleKey(rule)));
}

export function mergeProfileRules(
  profiles: readonly (readonly KiroPermissionRule[])[],
): KiroPermissionRule[] {
  if (profiles.length === 0) return [];
  const keySets = profiles.map(keysOf);
  const merged: KiroPermissionRule[] = [];
  const seen = new Set<string>();

  for (const effect of KIRO_EFFECTS) {
    for (const rules of profiles) {
      for (const rule of rules) {
        if (rule.effect !== effect) continue;
        const key = kiroRuleKey(rule);
        if (seen.has(key)) continue;
        if (effect !== 'deny' && !keySets.every((keys) => keys.has(key))) continue;
        seen.add(key);
        merged.push(rule);
      }
    }
  }
  return merged;
}
