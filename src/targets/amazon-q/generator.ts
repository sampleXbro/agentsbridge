/**
 * Amazon Q Developer generator.
 *
 * Generates `.amazonq/rules/<slug>.md` for non-root rules.
 * The root rule is written to `.amazonq/rules/_root.md`.
 * MCP is written to `.amazonq/mcp.json`.
 * Agents are written to `.amazonq/cli-agents/<name>.json`.
 *
 * Hooks (embedded): canonical PreToolUse/PostToolUse/UserPromptSubmit are mapped
 * to Amazon Q's preToolUse/postToolUse/userPromptSubmit trigger names and embedded
 * in each generated agent JSON under the top-level `hooks` key.
 *
 * Permissions (embedded): canonical permissions.allow is merged with per-agent
 * tools and embedded in each agent JSON as `allowedTools`. deny/ask have no
 * Amazon Q equivalent — lintPermissions warns about those.
 */

import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import type { FeatureGeneratorOutput } from '../catalog/target.interface.js';
import {
  AMAZON_Q_TARGET,
  AMAZON_Q_RULES_DIR,
  AMAZON_Q_MCP_FILE,
  AMAZON_Q_AGENTS_DIR,
} from './constants.js';

/**
 * Amazon Q hook trigger names that map from canonical event names.
 * Only these events have a direct equivalent in the Amazon Q agent format.
 */
const CANONICAL_TO_AQ_HOOK: ReadonlyMap<string, string> = new Map([
  ['PreToolUse', 'preToolUse'],
  ['PostToolUse', 'postToolUse'],
  ['UserPromptSubmit', 'userPromptSubmit'],
]);

/**
 * Build the Amazon Q `hooks` object from canonical hooks, mapping only the
 * supported trigger names. Returns undefined when nothing maps.
 */
function buildAmazonQHooks(
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

export function generateRules(canonical: CanonicalFiles): FeatureGeneratorOutput[] {
  const outputs: FeatureGeneratorOutput[] = [];

  for (const rule of canonical.rules) {
    // Skip rules filtered to other targets
    if (rule.targets.length > 0 && !rule.targets.includes(AMAZON_Q_TARGET)) continue;

    const slug = rule.root ? '_root' : basename(rule.source, '.md');
    outputs.push({
      path: `${AMAZON_Q_RULES_DIR}/${slug}.md`,
      content: rule.body.trim(),
    });
  }

  return outputs;
}

export function generateAgents(canonical: CanonicalFiles): FeatureGeneratorOutput[] {
  const aqHooks = buildAmazonQHooks(canonical.hooks);
  const globalAllow = canonical.permissions?.allow ?? [];

  return canonical.agents.map((agent) => {
    // Merge per-agent tools with canonical permissions.allow, deduplicating.
    const mergedTools = [...new Set([...agent.tools, ...globalAllow])];
    const hooks = aqHooks;

    return {
      path: `${AMAZON_Q_AGENTS_DIR}/${agent.name}.json`,
      content: JSON.stringify(
        {
          name: agent.name,
          ...(agent.description ? { description: agent.description } : {}),
          prompt: agent.body.trim(),
          ...(mergedTools.length > 0 ? { allowedTools: mergedTools } : {}),
          ...(hooks ? { hooks } : {}),
        },
        null,
        2,
      ),
    };
  });
}

/**
 * No-op: hooks are embedded inside each agent JSON by generateAgents.
 * This stub exists so the engine's generateHooksFeature dispatch finds a
 * registered generator and skips calling the lint-only partial path.
 */
export function generateHooks(_canonical: CanonicalFiles): FeatureGeneratorOutput[] {
  return [];
}

/**
 * No-op: permissions.allow is embedded inside each agent JSON by generateAgents.
 * deny/ask have no Amazon Q equivalent; lintPermissions warns about those.
 */
export function generatePermissions(_canonical: CanonicalFiles): FeatureGeneratorOutput[] {
  return [];
}

export function generateMcp(canonical: CanonicalFiles): FeatureGeneratorOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: AMAZON_Q_MCP_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}
