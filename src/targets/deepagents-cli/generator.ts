/**
 * Generate Deep Agents CLI target outputs from canonical files.
 *
 * Emits:
 *   - `.deepagents/AGENTS.md`   — root rule + embedded non-root rules
 *   - `.deepagents/skills/`     — skill bundles
 *   - `.deepagents/agents/`     — native subagent files (dedicated AGENTS.md
 *     per subagent — see `agent-format.ts`)
 *   - `.mcp.json`               — MCP servers (standard format)
 *
 * Commands have no dedicated file format (docs.langchain.com/oss/javascript/
 * deepagents/code/configuration): they are projected as skills, the same
 * embedding `generateSkills` already uses natively.
 *
 * Hooks have no project-level surface at all — see `global-hooks.ts` for the
 * global-only `~/.deepagents/hooks.json` support wired via `scopeExtras`.
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import { serializeDeepagentsAgent } from './agent-format.js';
import {
  DEEPAGENTS_CLI_TARGET,
  DEEPAGENTS_CLI_ROOT_FILE,
  DEEPAGENTS_CLI_SKILLS_DIR,
  DEEPAGENTS_CLI_AGENTS_DIR,
  DEEPAGENTS_CLI_MCP_FILE,
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
    path: `${DEEPAGENTS_CLI_AGENTS_DIR}/${agent.name}/AGENTS.md`,
    content: serializeDeepagentsAgent(agent),
  }));
}

export function generateMcp(canonical: CanonicalFiles): DeepagentsCliOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const content = JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2);
  return [{ path: DEEPAGENTS_CLI_MCP_FILE, content }];
}

/**
 * No-op stub — Deep Agents CLI has no dedicated ignore file and relies on
 * .gitignore. Lint warnings surface this via lintIgnore.
 */
export function generateIgnore(_canonical: CanonicalFiles): DeepagentsCliOutput[] {
  return [];
}

/**
 * No-op stub — Deep Agents CLI permissions are partially supported via
 * DEEPAGENTS_CODE_SHELL_ALLOW_LIST in .env; agentsmesh does not generate
 * permissions config. Lint warnings surface this via lintPermissions.
 */
export function generatePermissions(_canonical: CanonicalFiles): DeepagentsCliOutput[] {
  return [];
}
