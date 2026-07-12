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
import { AMP_TARGET, AMP_ROOT_FILE, AMP_SKILLS_DIR, AMP_MCP_FILE } from './constants.js';

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

/**
 * Commands have no declarative file format in Amp (ampcode.com/manual): they
 * only exist via `amp.registerCommand(...)` inside a TypeScript plugin. So
 * this projects each command as a skill — the same embedding `generateSkills`
 * already uses natively — rather than a dedicated command surface.
 */
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

/**
 * MCP + permissions are the only two settings sidecars Amp actually reads.
 * Amp has NO documented `amp.hooks` (or any) settings-file hooks key
 * (ampcode.com/manual never mentions hooks) — only the plugin-based
 * `amp.on(...)` event API, which is code, not a file agentsmesh can emit.
 * Do not add a hooks branch here; hooks capability is 'none'.
 */
export function buildAmpScopedSettings(
  canonical: CanonicalFiles,
  enabledFeatures: ReadonlySet<string>,
): AmpOutput[] {
  const outputs: AmpOutput[] = [];
  if (
    enabledFeatures.has('mcp') &&
    canonical.mcp &&
    Object.keys(canonical.mcp.mcpServers).length > 0
  ) {
    outputs.push({
      path: AMP_MCP_FILE,
      content: JSON.stringify({ 'amp.mcpServers': canonical.mcp.mcpServers }, null, 2),
    });
  }
  if (enabledFeatures.has('permissions') && canonical.permissions) {
    const { allow, deny } = canonical.permissions;
    const ask = canonical.permissions.ask ?? [];
    if (allow.length > 0 || deny.length > 0 || ask.length > 0) {
      const permissions: Record<string, string[]> = {};
      if (allow.length > 0) permissions.allow = allow;
      if (deny.length > 0) permissions.deny = deny;
      if (ask.length > 0) permissions.ask = ask;
      outputs.push({
        path: AMP_MCP_FILE,
        content: JSON.stringify({ 'amp.permissions': permissions }, null, 2),
      });
    }
  }
  return outputs;
}
