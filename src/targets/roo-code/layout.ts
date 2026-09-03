/**
 * Roo Code project and global layout definitions, plus capability objects
 * and the global-only custom-modes settings extra.
 */

import { join } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import type { TargetCapabilities } from '../catalog/target.interface.js';
import type { TargetLayout, ScopeExtrasFn } from '../catalog/target-descriptor.js';
import type { GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import { buildCustomMode } from './generator.js';
import {
  ROO_CODE_ROOT_RULE,
  ROO_CODE_RULES_DIR,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_MCP_FILE,
  ROO_CODE_MODES_FILE,
  ROO_CODE_GLOBAL_RULES_DIR,
  ROO_CODE_GLOBAL_COMMANDS_DIR,
  ROO_CODE_GLOBAL_SKILLS_DIR,
  ROO_CODE_GLOBAL_MCP_FILE,
  ROO_CODE_GLOBAL_ROOT_RULE,
  ROO_CODE_GLOBAL_AGENTS_SKILLS_DIR,
  ROO_CODE_GLOBAL_MODES_FILE,
  ROO_CODE_VSCODE_SETTINGS,
} from './constants.js';

export const project: TargetLayout = {
  rootInstructionPath: ROO_CODE_ROOT_RULE,
  skillDir: '.roo/skills',
  managedOutputs: {
    dirs: ['.roo/rules', '.roo/commands', '.roo/skills'],
    files: ['.roo/mcp.json', '.rooignore', '.roorules', ROO_CODE_MODES_FILE],
    // Shared VS Code workspace settings: agentsmesh owns only the two Roo
    // command-permission keys (see merge.ts).
    coOwnedFiles: [ROO_CODE_VSCODE_SETTINGS],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${ROO_CODE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${ROO_CODE_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

/**
 * Roo Code's real global custom-modes read path is
 * `<context.globalStorageUri.fsPath>/settings/custom_modes.yaml` — a
 * non-deterministic per-OS/per-fork VS Code extension globalStorage dir.
 * `~/.roo/settings/custom_modes.yaml` is a best-effort location, hence
 * capability stays 'partial' even though a real file IS written.
 */
export const generateRooGlobalExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global') return [];
  if (!enabledFeatures.has('agents') || canonical.agents.length === 0) return [];

  const customModes = canonical.agents.map(buildCustomMode);
  const content = yamlStringify({ customModes });
  const existing = await readFileSafe(join(projectRoot, ROO_CODE_GLOBAL_MODES_FILE));
  return [
    {
      target: 'roo-code',
      path: ROO_CODE_GLOBAL_MODES_FILE,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    },
  ];
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: ROO_CODE_GLOBAL_ROOT_RULE,
  skillDir: ROO_CODE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      ROO_CODE_GLOBAL_RULES_DIR,
      ROO_CODE_GLOBAL_COMMANDS_DIR,
      ROO_CODE_GLOBAL_SKILLS_DIR,
      ROO_CODE_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [ROO_CODE_GLOBAL_MCP_FILE],
    // Roo Code writes this file itself whenever the user creates a Global mode;
    // agentsmesh owns only the modes it marked (see modes-merge.ts).
    coOwnedFiles: [ROO_CODE_GLOBAL_MODES_FILE],
  },
  rewriteGeneratedPath(path) {
    // Transform project-level paths to global ~/.roo/ paths. The root rule
    // (`.roo/rules/00-root.md`) needs no special case: Roo Code's
    // loadRuleFiles() reads `.roo/rules/` from the global `~/.roo` dir the
    // same way as the project dir, so it falls through to the generic
    // rules-dir rewrite below (a no-op, since both dirs share the same name).
    if (path === ROO_CODE_MODES_FILE) {
      // Suppress .roomodes in global mode; scopeExtras emits the
      // custom_modes.yaml settings file instead.
      return null;
    }
    if (path.startsWith(`${ROO_CODE_RULES_DIR}/`)) {
      return path.replace(`${ROO_CODE_RULES_DIR}/`, `${ROO_CODE_GLOBAL_RULES_DIR}/`);
    }
    if (path.startsWith(`${ROO_CODE_COMMANDS_DIR}/`)) {
      return path.replace(`${ROO_CODE_COMMANDS_DIR}/`, `${ROO_CODE_GLOBAL_COMMANDS_DIR}/`);
    }
    if (path.startsWith(`${ROO_CODE_SKILLS_DIR}/`)) {
      return path.replace(`${ROO_CODE_SKILLS_DIR}/`, `${ROO_CODE_GLOBAL_SKILLS_DIR}/`);
    }
    if (path === ROO_CODE_MCP_FILE) {
      return ROO_CODE_GLOBAL_MCP_FILE;
    }
    // `.rooignore` is never generated in global scope (generateIgnore
    // short-circuits for scope === 'global'); no rewrite needed.
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, ROO_CODE_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath(slug, _rule) {
      return `${ROO_CODE_GLOBAL_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${ROO_CODE_GLOBAL_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

export const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'native',
  permissions: 'native',
};

export const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'partial',
  skills: 'native',
  mcp: 'partial',
  hooks: 'none',
  ignore: 'none',
  permissions: 'partial',
};
