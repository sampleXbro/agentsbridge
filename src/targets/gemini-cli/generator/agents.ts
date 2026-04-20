import type { CanonicalFiles } from '../../../core/types.js';
import { serializeFrontmatter } from '../../../utils/text/markdown.js';
import { GEMINI_AGENTS_DIR } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => {
    const frontmatter: Record<string, unknown> = {
      name: agent.name,
      kind: 'local',
      description: agent.description || undefined,
      tools: agent.tools.length > 0 ? agent.tools : undefined,
      model: agent.model || undefined,
      maxTurns: agent.maxTurns > 0 ? agent.maxTurns : undefined,
      permissionMode: agent.permissionMode || undefined,
      disallowedTools: agent.disallowedTools.length > 0 ? agent.disallowedTools : undefined,
    };
    Object.keys(frontmatter).forEach((k) => {
      if (frontmatter[k] === undefined) delete frontmatter[k];
    });
    const content = serializeFrontmatter(frontmatter, agent.body.trim() || '');
    return { path: `${GEMINI_AGENTS_DIR}/${agent.name}.md`, content };
  });
}
