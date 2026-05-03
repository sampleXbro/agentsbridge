import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import {
  ANTIGRAVITY_GLOBAL_ROOT,
  ANTIGRAVITY_MCP_CONFIG,
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
  ANTIGRAVITY_SKILLS_DIR,
} from './constants.js';

export interface AntigravityOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): AntigravityOutput[] {
  const root = canonical.rules.find((r) => r.root);
  if (!root) return [];

  const outputs: AntigravityOutput[] = [
    { path: ANTIGRAVITY_RULES_ROOT, content: root.body.trim() || '' },
  ];

  for (const rule of canonical.rules) {
    if (rule.root) continue;
    if (rule.targets.length > 0 && !rule.targets.includes('antigravity')) continue;
    const slug = basename(rule.source, '.md');
    outputs.push({
      path: `${ANTIGRAVITY_RULES_DIR}/${slug}.md`,
      content: rule.body.trim() || '',
    });
  }

  return outputs;
}

export function generateCommands(canonical: CanonicalFiles): AntigravityOutput[] {
  return canonical.commands.map((cmd) => {
    const intro = cmd.description.trim();
    const body = cmd.body.trim();
    const content =
      intro && body && !body.startsWith(intro) ? `${intro}\n\n${body}` : body || intro;
    return {
      path: `${ANTIGRAVITY_WORKFLOWS_DIR}/${cmd.name}.md`,
      content,
    };
  });
}

export function generateSkills(canonical: CanonicalFiles): AntigravityOutput[] {
  return generateEmbeddedSkills(canonical, ANTIGRAVITY_SKILLS_DIR);
}

export function generateMcp(canonical: CanonicalFiles): AntigravityOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: ANTIGRAVITY_MCP_CONFIG,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}

export function generateAgents(canonical: CanonicalFiles): AntigravityOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${ANTIGRAVITY_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}

export function renderAntigravityGlobalInstructions(canonical: CanonicalFiles): string {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes('antigravity');
  });

  return appendEmbeddedRulesBlock(root?.body.trim() ?? '', nonRootRules);
}

export { ANTIGRAVITY_GLOBAL_ROOT };
