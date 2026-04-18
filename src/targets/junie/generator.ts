import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import {
  JUNIE_AGENTS_DIR,
  JUNIE_COMMANDS_DIR,
  JUNIE_DOT_AGENTS,
  JUNIE_RULES_DIR,
  JUNIE_IGNORE,
  JUNIE_MCP_FILE,
  JUNIE_SKILLS_DIR,
} from './constants.js';

export interface JunieOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): JunieOutput[] {
  const outputs: JunieOutput[] = [];
  const root = canonical.rules.find((rule) => rule.root);

  if (root) {
    outputs.push({
      path: JUNIE_DOT_AGENTS,
      content: root.body.trim() || '',
    });
  }

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes('junie')) continue;
    const slug = basename(rule.source, '.md');
    outputs.push({
      path: `${JUNIE_RULES_DIR}/${slug}.md`,
      content: rule.body.trim() || '',
    });
  }

  return outputs;
}

export function generateMcp(canonical: CanonicalFiles): JunieOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: JUNIE_MCP_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}

export function generateCommands(canonical: CanonicalFiles): JunieOutput[] {
  return canonical.commands.map((command) => {
    return {
      path: `${JUNIE_COMMANDS_DIR}/${command.name}.md`,
      content: command.body.trim() || '',
    };
  });
}

export function generateAgents(canonical: CanonicalFiles): JunieOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${JUNIE_AGENTS_DIR}/${agent.name}.md`,
    content: agent.body.trim() || '',
  }));
}

export function generateIgnore(canonical: CanonicalFiles): JunieOutput[] {
  if (canonical.ignore.length === 0) return [];
  return [{ path: JUNIE_IGNORE, content: canonical.ignore.join('\n') }];
}

export function generateSkills(canonical: CanonicalFiles): JunieOutput[] {
  return generateEmbeddedSkills(canonical, JUNIE_SKILLS_DIR);
}

export function renderJunieGlobalInstructions(canonical: CanonicalFiles): string {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes('junie');
  });

  const sections: string[] = [];
  if (root?.body.trim()) {
    sections.push(root.body.trim());
  }

  for (const rule of nonRootRules) {
    const parts: string[] = [];
    if (rule.description) {
      parts.push(`## ${rule.description}`);
      parts.push('');
    }
    if (rule.body.trim()) {
      parts.push(rule.body.trim());
    }
    const section = parts.join('\n').trim();
    if (section) sections.push(section);
  }

  return sections.join('\n\n---\n\n');
}
