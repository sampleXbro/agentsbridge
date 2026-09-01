/**
 * Generate Goose target outputs from canonical files.
 *
 * Emits:
 *   - `.goosehints`                  — root rule + embedded non-root rules
 *   - `.agents/skills/`              — skill bundles
 *   - `.gooseignore`                 — ignore patterns
 *   - `.agents/plugins/agentsmesh/hooks/hooks.json` — lifecycle hooks
 *
 * MCP is NOT here: both of its files are merged into content agentsmesh does not
 * own, and only the optional-features paths hand a target a merge callback. See
 * `mcp-format.ts` (project plugin `.mcp.json`) and `global-mcp.ts` (`config.yaml`).
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import { buildWrappedCommandHooks } from '../import/wrapped-command-hooks.js';
import {
  GOOSE_TARGET,
  GOOSE_ROOT_FILE,
  GOOSE_SKILLS_DIR,
  GOOSE_IGNORE,
  GOOSE_HOOKS_FILE,
} from './constants.js';

export interface GooseOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): GooseOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(GOOSE_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: GOOSE_ROOT_FILE, content }];
}

export function generateSkills(canonical: CanonicalFiles): GooseOutput[] {
  return generateEmbeddedSkills(canonical, GOOSE_SKILLS_DIR);
}

export function generateCommands(canonical: CanonicalFiles): GooseOutput[] {
  return canonical.commands.map((command) => ({
    path: `${GOOSE_SKILLS_DIR}/${commandSkillDirName(command.name)}/SKILL.md`,
    content: serializeCommandSkill(command),
  }));
}

export function generateAgents(canonical: CanonicalFiles): GooseOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${GOOSE_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}

export function generateIgnore(canonical: CanonicalFiles): GooseOutput[] {
  if (canonical.ignore.length === 0) return [];
  return [{ path: GOOSE_IGNORE, content: canonical.ignore.join('\n') }];
}

export function generateHooks(canonical: CanonicalFiles): GooseOutput[] {
  return buildWrappedCommandHooks(canonical, GOOSE_HOOKS_FILE);
}

/**
 * No-op stub — Goose applies tool permissions only at global scope via
 * ~/.config/goose/permission.yaml (emitted by scopeExtras); project-scope
 * permissions have no file surface. Lint warnings surface this via
 * lintPermissions.
 */
export function generatePermissions(_canonical: CanonicalFiles): GooseOutput[] {
  return [];
}
