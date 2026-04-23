import type { CanonicalFiles } from '../../../core/types.js';
import { serializeFrontmatter } from '../../../utils/text/markdown.js';
import { CURSOR_AGENTS_DIR } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => {
    const frontmatter: Record<string, unknown> = {
      name: agent.name,
      description: agent.description,
      tools: agent.tools.length > 0 ? agent.tools : undefined,
      disallowedTools: agent.disallowedTools.length > 0 ? agent.disallowedTools : undefined,
      model: agent.model || undefined,
      permissionMode: agent.permissionMode || undefined,
      maxTurns: agent.maxTurns > 0 ? agent.maxTurns : undefined,
      mcpServers: agent.mcpServers.length > 0 ? agent.mcpServers : undefined,
      hooks: Object.keys(agent.hooks).length > 0 ? agent.hooks : undefined,
      skills: agent.skills.length > 0 ? agent.skills : undefined,
      memory: agent.memory || undefined,
    };
    Object.keys(frontmatter).forEach((k) => {
      if (frontmatter[k] === undefined) delete frontmatter[k];
    });
    const content = serializeFrontmatter(frontmatter, agent.body.trim() || '');
    return { path: `${CURSOR_AGENTS_DIR}/${agent.name}.md`, content };
  });
}
