/**
 * Generate Pi Coding Agent target outputs from canonical files.
 *
 * Emits:
 *   - `AGENTS.md`        -- root rule + embedded non-root rules
 *   - `.pi/prompts/`     -- native prompt templates (slash commands)
 *   - `.pi/skills/`      -- skill bundles
 *
 * Pi uses `AGENTS.md` at project root for instructions, `.pi/prompts/` for
 * prompt templates, and `.pi/skills/` for skill bundles following the Agent
 * Skills standard (SKILL.md).
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import {
  PI_AGENT_TARGET,
  PI_AGENT_ROOT_FILE,
  PI_AGENT_SKILLS_DIR,
  PI_AGENT_COMMANDS_DIR,
} from './constants.js';

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
  return canonical.commands.map((command) => {
    // Pi prompt templates support only `description` (+ `argument-hint`) in
    // frontmatter; canonical allowedTools have no equivalent and are dropped.
    const frontmatter: Record<string, unknown> = {};
    if (command.description) frontmatter.description = command.description;
    return {
      path: `${PI_AGENT_COMMANDS_DIR}/${command.name}.md`,
      content: serializeFrontmatter(frontmatter, command.body.trim() || ''),
    };
  });
}

export function generateAgents(canonical: CanonicalFiles): PiAgentOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${PI_AGENT_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}
