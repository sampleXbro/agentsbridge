import { basename } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import {
  ROO_CODE_TARGET,
  ROO_CODE_ROOT_RULE,
  ROO_CODE_RULES_DIR,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_MCP_FILE,
  ROO_CODE_IGNORE,
  ROO_CODE_MODES_FILE,
} from './constants.js';

export interface RooCodeOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): RooCodeOutput[] {
  const outputs: RooCodeOutput[] = [];
  const root = canonical.rules.find((rule) => rule.root);

  if (root) {
    outputs.push({
      path: ROO_CODE_ROOT_RULE,
      content: root.body.trim() || '',
    });
  }

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes(ROO_CODE_TARGET)) continue;
    const slug = basename(rule.source, '.md');
    outputs.push({
      path: `${ROO_CODE_RULES_DIR}/${slug}.md`,
      content: rule.body.trim() || '',
    });
  }

  return outputs;
}

export function generateCommands(canonical: CanonicalFiles): RooCodeOutput[] {
  return canonical.commands.map((command) => {
    const frontmatter: Record<string, unknown> = {};
    if (command.description) frontmatter.description = command.description;
    return {
      path: `${ROO_CODE_COMMANDS_DIR}/${command.name}.md`,
      content: serializeFrontmatter(frontmatter, command.body.trim() || ''),
    };
  });
}

export function generateMcp(canonical: CanonicalFiles): RooCodeOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: ROO_CODE_MCP_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}

export function generateIgnore(canonical: CanonicalFiles): RooCodeOutput[] {
  if (canonical.ignore.length === 0) return [];
  return [{ path: ROO_CODE_IGNORE, content: canonical.ignore.join('\n') }];
}

export function generateSkills(canonical: CanonicalFiles): RooCodeOutput[] {
  return generateEmbeddedSkills(canonical, ROO_CODE_SKILLS_DIR);
}

export function generateAgents(canonical: CanonicalFiles): RooCodeOutput[] {
  if (canonical.agents.length === 0) return [];
  const customModes = canonical.agents.map((agent) => {
    const slug = basename(agent.source, '.md');
    const mode: Record<string, unknown> = { slug, name: agent.name };
    if (agent.description) mode.description = agent.description;
    if (agent.body.trim()) mode.roleDefinition = agent.body.trim();
    return mode;
  });
  return [{ path: ROO_CODE_MODES_FILE, content: yamlStringify({ customModes }) }];
}
