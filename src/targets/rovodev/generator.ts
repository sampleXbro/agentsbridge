/**
 * Generate Rovo Dev target outputs from canonical files.
 *
 * Emits:
 *   - `AGENTS.md`          — root rule + embedded non-root rules
 *   - `.rovodev/skills/`   — skill bundles
 *   - `.rovodev/mcp.json`  — MCP servers
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import {
  ROVODEV_TARGET,
  ROVODEV_ROOT_FILE,
  ROVODEV_SKILLS_DIR,
  ROVODEV_MCP_FILE,
} from './constants.js';

export interface RovodevOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): RovodevOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(ROVODEV_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: ROVODEV_ROOT_FILE, content }];
}

export function generateSkills(canonical: CanonicalFiles): RovodevOutput[] {
  return generateEmbeddedSkills(canonical, ROVODEV_SKILLS_DIR);
}

export function generateCommands(canonical: CanonicalFiles): RovodevOutput[] {
  return canonical.commands.map((command) => ({
    path: `${ROVODEV_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  }));
}

export function generateAgents(canonical: CanonicalFiles): RovodevOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${ROVODEV_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}

export function generateMcp(canonical: CanonicalFiles): RovodevOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const content = JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2);
  return [{ path: ROVODEV_MCP_FILE, content }];
}
