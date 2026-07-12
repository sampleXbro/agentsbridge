/**
 * Generate .cline/agents.yaml from canonical agents.
 *
 * CLI docs (docs.cline.bot/cli/cli-reference) document a single project-only
 * `.cline/agents.yaml` file ("Agent definitions") — not a directory of files
 * and with no documented global equivalent. The per-entry field schema is
 * not documented beyond the filename/location, so agentsmesh uses a
 * reasonable, round-trippable shape: a top-level `agents:` list with
 * name/description/model/tools/prompt plus the same `x-agentsmesh-*`
 * extension keys used by other native-agent targets for fields Cline's own
 * schema doesn't define (disallowedTools, permissionMode, maxTurns,
 * mcpServers, hooks, skills, memory).
 */

import { stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles } from '../../core/types.js';
import type { GenerateFeatureContext } from '../catalog/target.interface.js';
import { CLINE_AGENTS_FILE } from './constants.js';
import type { RulesOutput } from './generator.js';

function omitUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function buildAgentEntry(agent: CanonicalFiles['agents'][number]): Record<string, unknown> {
  return omitUndefined({
    name: agent.name,
    description: agent.description || undefined,
    model: agent.model || undefined,
    tools: agent.tools.length > 0 ? agent.tools : undefined,
    prompt: agent.body.trim(),
    'x-agentsmesh-disallowed-tools':
      agent.disallowedTools.length > 0 ? agent.disallowedTools : undefined,
    'x-agentsmesh-permission-mode': agent.permissionMode || undefined,
    'x-agentsmesh-max-turns': agent.maxTurns > 0 ? agent.maxTurns : undefined,
    'x-agentsmesh-mcp-servers': agent.mcpServers.length > 0 ? agent.mcpServers : undefined,
    'x-agentsmesh-hooks': Object.keys(agent.hooks).length > 0 ? agent.hooks : undefined,
    'x-agentsmesh-skills': agent.skills.length > 0 ? agent.skills : undefined,
    'x-agentsmesh-memory': agent.memory || undefined,
  });
}

/**
 * Project-only: no documented global `.cline/agents.yaml` equivalent exists,
 * so this is a no-op for global scope.
 *
 * @param canonical - Loaded canonical files
 * @param ctx - Feature context (scope-gated: project only)
 * @returns Array with a single combined `.cline/agents.yaml` output, or [] if no agents or global scope
 */
export function generateAgents(
  canonical: CanonicalFiles,
  ctx?: GenerateFeatureContext,
): RulesOutput[] {
  if (ctx?.scope === 'global') return [];
  if (canonical.agents.length === 0) return [];
  const agents = canonical.agents.map(buildAgentEntry);
  return [{ path: CLINE_AGENTS_FILE, content: yamlStringify({ agents }) }];
}
