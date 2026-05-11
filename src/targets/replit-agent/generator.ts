/**
 * Generate Replit Agent target outputs from canonical files.
 *
 * Emits:
 *   - `replit.md`          — root rule + embedded non-root rules
 *   - `.agents/skills/`    — skill bundles
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
  REPLIT_AGENT_TARGET,
  REPLIT_AGENT_ROOT_FILE,
  REPLIT_AGENT_SKILLS_DIR,
} from './constants.js';

export interface ReplitAgentOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): ReplitAgentOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(REPLIT_AGENT_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: REPLIT_AGENT_ROOT_FILE, content }];
}

export function generateSkills(canonical: CanonicalFiles): ReplitAgentOutput[] {
  return generateEmbeddedSkills(canonical, REPLIT_AGENT_SKILLS_DIR);
}

export function generateCommands(canonical: CanonicalFiles): ReplitAgentOutput[] {
  return canonical.commands.map((command) => ({
    path: `${REPLIT_AGENT_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  }));
}

export function generateAgents(canonical: CanonicalFiles): ReplitAgentOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${REPLIT_AGENT_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}
