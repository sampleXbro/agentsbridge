/**
 * Amazon Q Developer generator.
 *
 * Generates `.amazonq/rules/<slug>.md` for non-root rules.
 * The root rule is written to `.amazonq/rules/_root.md`.
 * MCP is written to `.amazonq/mcp.json`.
 *
 * Amazon Q Developer does not have native commands, agents, skills, hooks,
 * ignore, or permissions — those canonical features are not generated.
 */

import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import type { FeatureGeneratorOutput } from '../catalog/target.interface.js';
import {
  AMAZON_Q_TARGET,
  AMAZON_Q_RULES_DIR,
  AMAZON_Q_MCP_FILE,
} from './constants.js';

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

export function generateMcp(canonical: CanonicalFiles): FeatureGeneratorOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: AMAZON_Q_MCP_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}
