import type { CanonicalFiles } from '../../core/types.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import { CLINE_AGENTS_DIR } from './constants.js';
import type { RulesOutput } from './generator.js';

export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${CLINE_AGENTS_DIR}/${agent.name}.md`,
    content: serializeFrontmatter(
      {
        name: agent.name,
        description: agent.description || undefined,
        tools: agent.tools.length > 0 ? agent.tools : undefined,
        model: agent.model || undefined,
        'x-agentsmesh-disallowed-tools':
          agent.disallowedTools.length > 0 ? agent.disallowedTools : undefined,
        'x-agentsmesh-permission-mode': agent.permissionMode || undefined,
        'x-agentsmesh-max-turns': agent.maxTurns > 0 ? agent.maxTurns : undefined,
        'x-agentsmesh-mcp-servers': agent.mcpServers.length > 0 ? agent.mcpServers : undefined,
        'x-agentsmesh-hooks': Object.keys(agent.hooks).length > 0 ? agent.hooks : undefined,
        'x-agentsmesh-skills': agent.skills.length > 0 ? agent.skills : undefined,
        'x-agentsmesh-memory': agent.memory || undefined,
      },
      agent.body.trim(),
    ),
  }));
}
