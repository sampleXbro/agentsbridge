/**
 * Generate Factory Droid target outputs from canonical files.
 *
 * Emits:
 *   - `AGENTS.md`            — root rule + embedded non-root rules
 *   - `.factory/skills/`     — skill bundles
 *   - `.factory/droids/`     — native droid definitions from canonical agents
 *   - `.factory/mcp.json`    — MCP server configuration
 *
 * Commands are projected as skills via `supportsConversion`.
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import { buildWrappedCommandHooks } from '../import/wrapped-command-hooks.js';
import { serializeDroid } from './droid-serializer.js';
import {
  FACTORY_DROID_TARGET,
  FACTORY_DROID_ROOT_FILE,
  FACTORY_DROID_SKILLS_DIR,
  FACTORY_DROID_DROIDS_DIR,
  FACTORY_DROID_MCP_FILE,
  FACTORY_DROID_HOOKS_FILE,
} from './constants.js';

export interface FactoryDroidOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): FactoryDroidOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(FACTORY_DROID_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: FACTORY_DROID_ROOT_FILE, content }];
}

export function generateSkills(canonical: CanonicalFiles): FactoryDroidOutput[] {
  return generateEmbeddedSkills(canonical, FACTORY_DROID_SKILLS_DIR);
}

export function generateCommands(canonical: CanonicalFiles): FactoryDroidOutput[] {
  return canonical.commands.map((command) => ({
    path: `${FACTORY_DROID_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  }));
}

export function generateAgents(canonical: CanonicalFiles): FactoryDroidOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${FACTORY_DROID_DROIDS_DIR}/${agent.name}.md`,
    content: serializeDroid(agent),
  }));
}

export function generateHooks(canonical: CanonicalFiles): FactoryDroidOutput[] {
  return buildWrappedCommandHooks(canonical, FACTORY_DROID_HOOKS_FILE);
}

export function generateMcp(canonical: CanonicalFiles): FactoryDroidOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];

  return [
    {
      path: FACTORY_DROID_MCP_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}
