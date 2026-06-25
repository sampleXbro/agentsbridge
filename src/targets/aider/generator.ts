/**
 * Generate Aider target outputs from canonical files.
 *
 * Emits:
 *   - `CONVENTIONS.md`    — root rule + embedded non-root rules
 *   - `.aider.conf.yml`   — wires CONVENTIONS.md via `read:` (aider has no auto-discovery)
 *   - `.aider/skills/`    — skill bundles
 *   - `.aiderignore`      — ignore patterns
 */

import type { CanonicalFiles } from '../../core/types.js';
import { stringify as stringifyYaml } from 'yaml';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import {
  AIDER_TARGET,
  AIDER_CONVENTIONS,
  AIDER_CONF_FILE,
  AIDER_SKILLS_DIR,
  AIDER_IGNORE,
} from './constants.js';

export interface AiderOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): AiderOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(AIDER_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  // Aider does not auto-load CONVENTIONS.md; wire it via `.aider.conf.yml read:`
  // so the conventions actually take effect. (Project scope only — the global
  // rewrite suppresses this file.)
  return [
    { path: AIDER_CONVENTIONS, content },
    { path: AIDER_CONF_FILE, content: stringifyYaml({ read: [AIDER_CONVENTIONS] }) },
  ];
}

export function generateSkills(canonical: CanonicalFiles): AiderOutput[] {
  return generateEmbeddedSkills(canonical, AIDER_SKILLS_DIR);
}

export function generateCommands(canonical: CanonicalFiles): AiderOutput[] {
  return canonical.commands.map((command) => ({
    path: `${AIDER_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  }));
}

export function generateAgents(canonical: CanonicalFiles): AiderOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${AIDER_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}

export function generateIgnore(canonical: CanonicalFiles): AiderOutput[] {
  if (canonical.ignore.length === 0) return [];
  return [{ path: AIDER_IGNORE, content: canonical.ignore.join('\n') }];
}
