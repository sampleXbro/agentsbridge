/**
 * Qwen Code project and global layout definitions, plus capability objects.
 */

import type { TargetCapabilities } from '../catalog/target.interface.js';
import type { TargetLayout } from '../catalog/target-descriptor.js';
import {
  QWEN_ROOT,
  QWEN_RULES_DIR,
  QWEN_COMMANDS_DIR,
  QWEN_AGENTS_DIR,
  QWEN_SKILLS_DIR,
  QWEN_SETTINGS,
  QWEN_IGNORE,
  QWEN_GLOBAL_ROOT,
  QWEN_GLOBAL_SETTINGS,
  QWEN_GLOBAL_RULES_DIR,
  QWEN_GLOBAL_COMMANDS_DIR,
  QWEN_GLOBAL_AGENTS_DIR,
  QWEN_GLOBAL_SKILLS_DIR,
} from './constants.js';

export const project: TargetLayout = {
  rootInstructionPath: QWEN_ROOT,
  skillDir: QWEN_SKILLS_DIR,
  managedOutputs: {
    dirs: [QWEN_RULES_DIR, QWEN_COMMANDS_DIR, QWEN_AGENTS_DIR, QWEN_SKILLS_DIR],
    files: [QWEN_ROOT, QWEN_IGNORE],
    // Qwen's own settings file (theme, auth, model, JSONC comments);
    // agentsmesh owns mcpServers / hooks / permissions inside it.
    coOwnedFiles: [QWEN_SETTINGS],
  },
  paths: {
    rulePath(slug, rule) {
      if (rule.root) return QWEN_ROOT;
      return `${QWEN_RULES_DIR}/${slug}.md`;
    },
    commandPath(name) {
      return `${QWEN_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${QWEN_AGENTS_DIR}/${name}.md`;
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: QWEN_GLOBAL_ROOT,
  skillDir: QWEN_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      QWEN_GLOBAL_RULES_DIR,
      QWEN_GLOBAL_COMMANDS_DIR,
      QWEN_GLOBAL_AGENTS_DIR,
      QWEN_GLOBAL_SKILLS_DIR,
    ],
    files: [QWEN_GLOBAL_ROOT],
    coOwnedFiles: [QWEN_GLOBAL_SETTINGS],
  },
  rewriteGeneratedPath(path) {
    if (path === QWEN_ROOT) return QWEN_GLOBAL_ROOT;
    if (path === QWEN_SETTINGS) return QWEN_GLOBAL_SETTINGS;
    if (path === QWEN_IGNORE) return null;
    if (path.startsWith(`${QWEN_COMMANDS_DIR}/`)) {
      return path.replace(`${QWEN_COMMANDS_DIR}/`, `${QWEN_GLOBAL_COMMANDS_DIR}/`);
    }
    if (path.startsWith(`${QWEN_AGENTS_DIR}/`)) {
      return path.replace(`${QWEN_AGENTS_DIR}/`, `${QWEN_GLOBAL_AGENTS_DIR}/`);
    }
    if (path.startsWith(`${QWEN_SKILLS_DIR}/`)) {
      return path.replace(`${QWEN_SKILLS_DIR}/`, `${QWEN_GLOBAL_SKILLS_DIR}/`);
    }
    if (path.startsWith(`${QWEN_RULES_DIR}/`)) {
      // Qwen Code's loadRules() reads `.qwen/rules/` from BOTH the global
      // `~/.qwen` dir and the project dir (rulesDiscovery.ts), so non-root
      // rules mirror through as real global files instead of being embedded.
      return path.replace(`${QWEN_RULES_DIR}/`, `${QWEN_GLOBAL_RULES_DIR}/`);
    }
    return path;
  },
  paths: {
    rulePath(slug, rule) {
      if (rule.root) return QWEN_GLOBAL_ROOT;
      return `${QWEN_GLOBAL_RULES_DIR}/${slug}.md`;
    },
    commandPath(name) {
      return `${QWEN_GLOBAL_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${QWEN_GLOBAL_AGENTS_DIR}/${name}.md`;
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
  hooks: 'native',
  ignore: 'native',
  permissions: 'native',
};

export const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'none',
  permissions: 'native',
};
