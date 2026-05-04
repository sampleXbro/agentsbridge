/**
 * Generate Warp target outputs from canonical files.
 *
 * Emits:
 *   - `AGENTS.md`        — root rule + embedded non-root rules
 *   - `.warp/skills/`    — skill bundles
 *   - `.mcp.json`        — MCP servers (standard format)
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import { WARP_TARGET, WARP_ROOT_FILE, WARP_SKILLS_DIR, WARP_MCP_FILE } from './constants.js';

export interface WarpOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): WarpOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(WARP_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: WARP_ROOT_FILE, content }];
}

export function generateSkills(canonical: CanonicalFiles): WarpOutput[] {
  return generateEmbeddedSkills(canonical, WARP_SKILLS_DIR);
}

export function generateCommands(canonical: CanonicalFiles): WarpOutput[] {
  return canonical.commands.map((command) => ({
    path: `${WARP_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  }));
}

export function generateAgents(canonical: CanonicalFiles): WarpOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${WARP_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}

export function generateMcp(canonical: CanonicalFiles): WarpOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const content = JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2);
  return [{ path: WARP_MCP_FILE, content }];
}
