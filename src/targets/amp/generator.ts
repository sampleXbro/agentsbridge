/**
 * Generate Amp target outputs from canonical files.
 *
 * Emits:
 *   - `AGENTS.md`          — root rule + embedded non-root rules
 *   - `.agents/skills/`    — skill bundles
 *
 * MCP is emitted via `emitScopedSettings` (not generateMcp) because
 * Amp stores MCP servers inside `.amp/settings.json` alongside other
 * workspace settings, requiring a JSON-merge strategy.
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import { AMP_TARGET, AMP_ROOT_FILE, AMP_SKILLS_DIR } from './constants.js';

export interface AmpOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): AmpOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(AMP_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: AMP_ROOT_FILE, content }];
}

export function generateSkills(canonical: CanonicalFiles): AmpOutput[] {
  return generateEmbeddedSkills(canonical, AMP_SKILLS_DIR);
}

export function generateCommands(canonical: CanonicalFiles): AmpOutput[] {
  return canonical.commands.map((command) => ({
    path: `${AMP_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  }));
}

export function generateAgents(canonical: CanonicalFiles): AmpOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${AMP_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}
