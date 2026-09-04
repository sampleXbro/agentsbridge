/**
 * Generate Warp target outputs from canonical files.
 *
 * Emits:
 *   - `AGENTS.md`            — root rule + embedded non-root rules (global
 *                              scope rebases this to `~/.agents/AGENTS.md`)
 *   - `.warp/skills/`        — skill bundles
 *   - `.warp/.mcp.json`      — MCP servers, standard format (project scope)
 *   - `~/.warp/.mcp.json`    — MCP servers, standard format (global scope,
 *                              rebased under home dir by the engine)
 *   - `.warpindexingignore`  — indexing exclusions (project scope)
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { GenerateFeatureContext } from '../catalog/target.interface.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../projection/projected-agent-skill.js';
import { commandSkillDirName, serializeCommandSkill } from '../codex-cli/command-skill.js';
import {
  WARP_TARGET,
  WARP_ROOT_FILE,
  WARP_SKILLS_DIR,
  WARP_MCP_FILE,
  WARP_GLOBAL_MCP_FILE,
  WARP_IGNORE_FILE,
} from './constants.js';

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

export function generateMcp(canonical: CanonicalFiles, ctx?: GenerateFeatureContext): WarpOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  // Both project and global scopes use the `.warp/.mcp.json` path shape — the
  // engine rebases global paths under the home dir. The constants are equal
  // (`.warp/.mcp.json`) but we branch explicitly for clarity and forward-safety.
  const path = ctx?.scope === 'global' ? WARP_GLOBAL_MCP_FILE : WARP_MCP_FILE;
  const content = JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2);
  return [{ path, content }];
}

/**
 * No-op stub — `~/.warp/settings.toml` is user-level only, so permissions are
 * emitted from `globalSupport.scopeExtras` (see `global-permissions.ts`), never
 * at project scope. Lint warnings surface this via lintPermissions.
 */
export function generatePermissions(_canonical: CanonicalFiles): WarpOutput[] {
  return [];
}

/**
 * No-op stub — Warp has no lifecycle hook system.
 * Lint warnings surface this via lintHooks.
 */
export function generateHooks(_canonical: CanonicalFiles): WarpOutput[] {
  return [];
}

/**
 * `.warpindexingignore` — gitignore syntax, project root only. The global
 * layout suppresses this path; Warp's home-level equivalent is a GUI
 * indexed-folders control, surfaced by lintIgnore instead.
 */
export function generateIgnore(canonical: CanonicalFiles): WarpOutput[] {
  if (canonical.ignore.length === 0) return [];
  return [{ path: WARP_IGNORE_FILE, content: canonical.ignore.join('\n') }];
}
