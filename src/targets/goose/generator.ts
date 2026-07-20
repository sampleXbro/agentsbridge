/**
 * Generate Goose target outputs from canonical files.
 *
 * Emits:
 *   - `.goosehints`                  — root rule + embedded non-root rules
 *   - `.agents/skills/`              — skill bundles
 *   - `.gooseignore`                 — ignore patterns
 *   - `.config/goose/config.yaml`    — MCP extensions (global scope only)
 *   - `.agents/plugins/agentsmesh/hooks/hooks.json` — lifecycle hooks
 */

import { stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles } from '../../core/types.js';
import type { McpServer } from '../../core/mcp-types.js';
import type { GenerateFeatureContext } from '../catalog/target.interface.js';
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
  GOOSE_GLOBAL_CONFIG,
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

interface GooseExtension {
  args?: string[];
  bundled: null;
  cmd?: string;
  description: string;
  enabled: boolean;
  env_keys: string[];
  envs: Record<string, string>;
  name: string;
  timeout: number;
  type: string;
  uri?: string;
}

function mcpServerToExtension(name: string, server: McpServer): GooseExtension {
  const base: GooseExtension = {
    bundled: null,
    description: server.description ?? '',
    enabled: true,
    env_keys: [],
    envs: server.env ?? {},
    name,
    timeout: 30,
    type: 'command' in server ? 'stdio' : 'sse',
  };
  if ('command' in server) {
    return { ...base, args: server.args ?? [], cmd: server.command };
  }
  return { ...base, uri: server.url };
}

export function generateMcp(
  canonical: CanonicalFiles,
  ctx?: GenerateFeatureContext,
): GooseOutput[] {
  if (ctx?.scope !== 'global') return [];
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const extensions = Object.fromEntries(
    Object.entries(canonical.mcp.mcpServers).map(([name, server]) => [
      name,
      mcpServerToExtension(name, server),
    ]),
  );
  return [{ path: GOOSE_GLOBAL_CONFIG, content: yamlStringify({ extensions }) }];
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
