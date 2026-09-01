/**
 * Builders for the optional keys of an Amazon Q agent JSON.
 *
 * The agent file is the only writable surface for hooks, permissions, ignore and
 * global rules, so `generateAgents` is the single writer for all four. The keys
 * never collide: `hooks`, `allowedTools`, `toolsSettings` and `resources`.
 *
 * CAVEAT: everything embedded here applies only while that agent is the selected
 * agent (`q chat --agent <name>` or `q settings chat.defaultAgent`). Q's built-in
 * default agent carries no `toolsSettings` — that conditionality is why ignore and
 * permissions are `embedded`, not `native`.
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import {
  AMAZON_Q_TARGET,
  AMAZON_Q_PROJECT_RULES_RESOURCE,
  AMAZON_Q_GLOBAL_RULES_RESOURCE,
  AMAZON_Q_DEFAULT_AGENT_RESOURCES,
} from './constants.js';

/** Amazon Q hook trigger names that map from canonical event names. */
const CANONICAL_TO_AQ_HOOK: ReadonlyMap<string, string> = new Map([
  ['PreToolUse', 'preToolUse'],
  ['PostToolUse', 'postToolUse'],
  ['UserPromptSubmit', 'userPromptSubmit'],
]);

/** Tool settings targets that accept `deniedPaths` (docs/built-in-tools.md). */
export const AQ_DENIED_PATH_TOOLS = ['fs_read', 'fs_write'] as const;

/** Build the `hooks` object, mapping only supported triggers. Undefined when nothing maps. */
export function buildAgentHooks(
  canonicalHooks: CanonicalFiles['hooks'],
): Record<string, unknown> | undefined {
  if (!canonicalHooks) return undefined;
  const result: Record<string, unknown> = {};
  for (const [canonicalEvent, aqEvent] of CANONICAL_TO_AQ_HOOK) {
    const entries = canonicalHooks[canonicalEvent];
    if (!Array.isArray(entries) || entries.length === 0) continue;
    result[aqEvent] = entries.map((entry) => {
      const hook: Record<string, unknown> = { command: entry.command };
      if (entry.matcher) hook.matcher = entry.matcher;
      return hook;
    });
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** True when the rule is generated for Amazon Q (no target filter, or explicitly listed). */
export function isAmazonQRule(rule: CanonicalFiles['rules'][number]): boolean {
  return rule.targets.length === 0 || rule.targets.includes(AMAZON_Q_TARGET);
}

/**
 * Build the `resources` array for a generated agent.
 *
 * A custom agent deserializes `resources` with `#[serde(default)]`, so it inherits
 * nothing: the entries the built-in `Agent::default()` builds (DEFAULT_AGENT_RESOURCES
 * then the rules glob) have to be written out for parity. Nothing here is conditional
 * on canonical content — this array describes what the agent may READ, not what
 * agentsmesh generated, so a hand-maintained `.amazonq/rules` stays reachable too.
 * Global agents keep the project glob as well, so selecting a global agent inside a
 * project still loads that project's rules.
 */
export function buildAgentResources(scope: TargetLayoutScope): string[] {
  const resources = [...AMAZON_Q_DEFAULT_AGENT_RESOURCES, AMAZON_Q_PROJECT_RULES_RESOURCE];
  return scope === 'global' ? [...resources, AMAZON_Q_GLOBAL_RULES_RESOURCE] : resources;
}

/** Gitignore re-inclusions; `deniedPaths` is a flat deny list with no negation. */
export function isNegatedPattern(pattern: string): boolean {
  return pattern.startsWith('!');
}

/**
 * Build `toolsSettings` with the canonical ignore patterns as `deniedPaths` on every
 * path-aware tool. Patterns are written verbatim so import round-trips them unchanged.
 */
export function buildToolsSettings(
  ignore: CanonicalFiles['ignore'],
): Record<string, unknown> | undefined {
  const deniedPaths = ignore.filter((pattern) => !isNegatedPattern(pattern));
  if (deniedPaths.length === 0) return undefined;
  return Object.fromEntries(AQ_DENIED_PATH_TOOLS.map((tool) => [tool, { deniedPaths }]));
}
