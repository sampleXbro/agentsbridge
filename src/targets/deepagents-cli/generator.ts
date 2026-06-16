/**
 * Generate Deep Agents CLI target outputs from canonical files.
 *
 * Emits:
 *   - `.deepagents/AGENTS.md`   — root rule + embedded non-root rules
 *   - `.deepagents/skills/`     — skill bundles
 *   - `.mcp.json`               — MCP servers (standard format)
 *   - `.deepagents/hooks.json`  — lifecycle hooks (Claude Code format)
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import { buildClaudeHooksObjectFromCanonical } from '../claude-code/hooks-format.js';
import {
  DEEPAGENTS_CLI_TARGET,
  DEEPAGENTS_CLI_ROOT_FILE,
  DEEPAGENTS_CLI_SKILLS_DIR,
  DEEPAGENTS_CLI_MCP_FILE,
  DEEPAGENTS_CLI_HOOKS_FILE,
} from './constants.js';

export interface DeepagentsCliOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): DeepagentsCliOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(DEEPAGENTS_CLI_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: DEEPAGENTS_CLI_ROOT_FILE, content }];
}

export function generateSkills(canonical: CanonicalFiles): DeepagentsCliOutput[] {
  return generateEmbeddedSkills(canonical, DEEPAGENTS_CLI_SKILLS_DIR);
}

export function generateCommands(canonical: CanonicalFiles): DeepagentsCliOutput[] {
  return canonical.commands.map((command) => ({
    path: `${DEEPAGENTS_CLI_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  }));
}

export function generateAgents(canonical: CanonicalFiles): DeepagentsCliOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${DEEPAGENTS_CLI_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}

export function generateMcp(canonical: CanonicalFiles): DeepagentsCliOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const content = JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2);
  return [{ path: DEEPAGENTS_CLI_MCP_FILE, content }];
}

export function generateHooks(canonical: CanonicalFiles): DeepagentsCliOutput[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const hooks = buildClaudeHooksObjectFromCanonical(canonical);
  if (Object.keys(hooks).length === 0) return [];
  return [{ path: DEEPAGENTS_CLI_HOOKS_FILE, content: JSON.stringify(hooks, null, 2) }];
}
