import { join, basename } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import type { GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { CONTINUE_GLOBAL_CONFIG } from './constants.js';

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

/**
 * Emits ~/.continue/config.yaml aggregating rules, prompts, and mcpServers.
 * Only runs in global scope when at least one of rules/commands/mcp is enabled and non-empty.
 */
export const generateContinueGlobalConfig: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global') return [];

  const hasRules = enabledFeatures.has('rules');
  const hasCommands = enabledFeatures.has('commands');
  const hasMcp = enabledFeatures.has('mcp');

  const hasData =
    (hasRules && canonical.rules.length > 0) ||
    (hasCommands && canonical.commands.length > 0) ||
    (hasMcp && canonical.mcp !== null && Object.keys(canonical.mcp.mcpServers).length > 0);

  if (!hasData) return [];

  const config: Record<string, unknown> = {
    name: 'agentsmesh',
    version: 1,
    schema: 'v1',
  };

  if (hasRules && canonical.rules.length > 0) {
    config.rules = canonical.rules.map((rule) => ({
      name: rule.description || basename(rule.source, '.md'),
      rule: rule.body.trim(),
    }));
  }

  if (hasCommands && canonical.commands.length > 0) {
    config.prompts = canonical.commands.map((cmd) => {
      const entry: Record<string, unknown> = { name: cmd.name };
      if (cmd.description) entry.description = cmd.description;
      entry.prompt = cmd.body.trim();
      return entry;
    });
  }

  if (hasMcp && canonical.mcp !== null) {
    const servers = Object.entries(canonical.mcp.mcpServers);
    if (servers.length > 0) {
      config.mcpServers = servers.map(([name, server]) => ({ name, ...server }));
    }
  }

  const content = yamlStringify(config);
  const existing = await readFileSafe(join(projectRoot, CONTINUE_GLOBAL_CONFIG));
  return [
    {
      target: 'continue',
      path: CONTINUE_GLOBAL_CONFIG,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    },
  ];
};
