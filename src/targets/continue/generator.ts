import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import { serializeCommandRule } from './command-rule.js';
import {
  CONTINUE_MCP_FILE,
  CONTINUE_PROMPTS_DIR,
  CONTINUE_ROOT_RULE,
  CONTINUE_RULES_DIR,
  CONTINUE_SKILLS_DIR,
} from './constants.js';

export interface ContinueOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): ContinueOutput[] {
  const outputs: ContinueOutput[] = [];
  const root = canonical.rules.find((rule) => rule.root);
  if (root) {
    const frontmatter: Record<string, unknown> = {};
    if (root.description) frontmatter.description = root.description;
    outputs.push({
      path: CONTINUE_ROOT_RULE,
      content: serializeFrontmatter(frontmatter, root.body.trim() || ''),
    });
  }

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes('continue')) continue;

    const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
    const frontmatter: Record<string, unknown> = {};
    if (rule.description) frontmatter.description = rule.description;
    if (rule.globs.length > 0) frontmatter.globs = rule.globs;
    outputs.push({
      path: `${CONTINUE_RULES_DIR}/${slug}.md`,
      content: serializeFrontmatter(frontmatter, rule.body.trim() || ''),
    });
  }

  return outputs;
}

export function generateCommands(canonical: CanonicalFiles): ContinueOutput[] {
  return canonical.commands.map((command) => ({
    path: `${CONTINUE_PROMPTS_DIR}/${command.name}.md`,
    content: serializeCommandRule(command),
  }));
}

export function generateMcp(canonical: CanonicalFiles): ContinueOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: CONTINUE_MCP_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}

export function generateSkills(canonical: CanonicalFiles): ContinueOutput[] {
  return generateEmbeddedSkills(canonical, CONTINUE_SKILLS_DIR);
}
