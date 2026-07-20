/**
 * Generate .cline/agents.yaml from canonical agents.
 *
 * Cline documents `.cline/agents.yaml` as the agents surface in the standalone
 * CLI reference (docs.cline.bot/cli/cli-reference). This generator writes a
 * single combined YAML file with a top-level `agents:` list. Each entry
 * carries the documented fields (name, description, model, tools, prompt) plus
 * the same `x-agentsmesh-*` extension keys used by other targets so that
 * round-trips back through the importer preserve all canonical metadata.
 */

import { stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles } from '../../core/types.js';
import type { GenerateFeatureContext } from '../catalog/target.interface.js';
import { CLINE_AGENTS_FILE } from './constants.js';
import type { RulesOutput } from './generator.js';

function buildAgentEntry(agent: CanonicalFiles['agents'][number]): Record<string, unknown> {
  const entry: Record<string, unknown> = { name: agent.name };
  if (agent.description) entry.description = agent.description;
  if (agent.model) entry.model = agent.model;
  if (agent.tools.length > 0) entry.tools = agent.tools;
  if (agent.body.trim()) entry.prompt = agent.body.trim();

  // Extension keys — round-trippable via agent-importer's EXTENSION_KEYS map
  if (agent.disallowedTools.length > 0) {
    entry['x-agentsmesh-disallowed-tools'] = agent.disallowedTools;
  }
  if (agent.permissionMode) entry['x-agentsmesh-permission-mode'] = agent.permissionMode;
  if (agent.maxTurns > 0) entry['x-agentsmesh-max-turns'] = agent.maxTurns;
  if (agent.mcpServers.length > 0) entry['x-agentsmesh-mcp-servers'] = agent.mcpServers;
  if (Object.keys(agent.hooks).length > 0) entry['x-agentsmesh-hooks'] = agent.hooks;
  if (agent.skills.length > 0) entry['x-agentsmesh-skills'] = agent.skills;
  if (agent.memory) entry['x-agentsmesh-memory'] = agent.memory;

  return entry;
}

/**
 * Project-only: no documented global `.cline/agents.yaml` equivalent exists,
 * so this is a no-op for global scope.
 *
 * @param canonical - Loaded canonical files
 * @param ctx - Feature context (scope-gated: project only)
 * @returns Single `.cline/agents.yaml` output, or [] if no agents or global scope
 */
export function generateAgents(
  canonical: CanonicalFiles,
  ctx?: GenerateFeatureContext,
): RulesOutput[] {
  if (ctx?.scope === 'global') return [];
  if (canonical.agents.length === 0) return [];

  const agentsList = canonical.agents.map(buildAgentEntry);
  const content = yamlStringify({ agents: agentsList }, { lineWidth: 0 });
  return [{ path: CLINE_AGENTS_FILE, content }];
}
