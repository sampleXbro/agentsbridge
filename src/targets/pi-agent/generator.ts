/**
 * Generate Pi Coding Agent target outputs from canonical files.
 *
 * Emits:
 *   - `AGENTS.md`        -- root rule + embedded non-root rules
 *   - `.pi/skills/`      -- skill bundles
 *
 * Pi uses `AGENTS.md` at project root for instructions and `.pi/skills/`
 * for skill bundles following the Agent Skills standard (SKILL.md).
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import { PI_AGENT_TARGET, PI_AGENT_ROOT_FILE, PI_AGENT_SKILLS_DIR } from './constants.js';

export interface PiAgentOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): PiAgentOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(PI_AGENT_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: PI_AGENT_ROOT_FILE, content }];
}

export function generateSkills(canonical: CanonicalFiles): PiAgentOutput[] {
  return generateEmbeddedSkills(canonical, PI_AGENT_SKILLS_DIR);
}

export function generateCommands(canonical: CanonicalFiles): PiAgentOutput[] {
  return canonical.commands.map((command) => ({
    path: `${PI_AGENT_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  }));
}

export function generateAgents(canonical: CanonicalFiles): PiAgentOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${PI_AGENT_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}
