import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import {
  TRAE_TARGET,
  TRAE_PROJECT_RULES,
  TRAE_RULES_DIR,
  TRAE_COMMANDS_DIR,
  TRAE_SKILLS_DIR,
  TRAE_MCP_FILE,
  TRAE_IGNORE,
} from './constants.js';

export interface TraeOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): TraeOutput[] {
  const outputs: TraeOutput[] = [];

  const root = canonical.rules.find((rule) => rule.root);
  if (root) {
    outputs.push({ path: TRAE_PROJECT_RULES, content: root.body.trim() });
  }

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes(TRAE_TARGET)) continue;
    const slug = basename(rule.source, '.md');
    outputs.push({
      path: `${TRAE_RULES_DIR}/${slug}.md`,
      content: rule.body.trim(),
    });
  }

  return outputs;
}

export function generateCommands(canonical: CanonicalFiles): TraeOutput[] {
  return canonical.commands.map((command) => {
    const frontmatter: Record<string, unknown> = {};
    if (command.description) frontmatter.description = command.description;
    return {
      path: `${TRAE_COMMANDS_DIR}/${command.name}.md`,
      content: serializeFrontmatter(frontmatter, command.body.trim() || ''),
    };
  });
}

export function generateSkills(canonical: CanonicalFiles): TraeOutput[] {
  return generateEmbeddedSkills(canonical, TRAE_SKILLS_DIR);
}

export function generateMcp(canonical: CanonicalFiles): TraeOutput[] {
  if (canonical.mcp === null || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: TRAE_MCP_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}

export function generateIgnore(canonical: CanonicalFiles): TraeOutput[] {
  if (canonical.ignore.length === 0) return [];
  return [{ path: TRAE_IGNORE, content: canonical.ignore.join('\n') }];
}
