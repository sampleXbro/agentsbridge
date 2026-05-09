/**
 * Qwen Code target descriptor.
 *
 * Qwen Code is Alibaba's CLI coding agent (qwen.ai/qwencode), powered by Qwen3 models.
 * Config lives under `.qwen/` at project level and `~/.qwen/` globally.
 *
 * Generation emits:
 *   - `QWEN.md`                — root rule (primary instructions)
 *   - `.qwen/rules/*.md`       — scoped additional rules
 *   - `.qwen/commands/*.md`    — slash commands
 *   - `.qwen/agents/*.md`      — sub-agent definitions
 *   - `.qwen/skills/<name>/`   — skill bundles (SKILL.md + supporting files)
 *   - `.qwen/settings.json`    — MCP server configuration
 *   - `.qwenignore`            — file ignore patterns
 *
 * Import reads all of the above from a project or global scope.
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
} from './generator.js';
import { importFromQwenCode } from './importer.js';
import { lintRules } from './linter.js';
import { buildQwenCodeImportPaths } from '../../core/reference/import-map-builders.js';
import {
  QWEN_CODE_TARGET,
  QWEN_ROOT,
  QWEN_RULES_DIR,
  QWEN_COMMANDS_DIR,
  QWEN_AGENTS_DIR,
  QWEN_SKILLS_DIR,
  QWEN_SETTINGS,
  QWEN_IGNORE,
  QWEN_GLOBAL_ROOT,
  QWEN_GLOBAL_SETTINGS,
  QWEN_GLOBAL_COMMANDS_DIR,
  QWEN_GLOBAL_AGENTS_DIR,
  QWEN_GLOBAL_SKILLS_DIR,
  QWEN_CANONICAL_RULES_DIR,
  QWEN_CANONICAL_COMMANDS_DIR,
  QWEN_CANONICAL_AGENTS_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: QWEN_CODE_TARGET,
  primaryRootInstructionPath: QWEN_ROOT,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  importFrom: importFromQwenCode,
};

const project: TargetLayout = {
  rootInstructionPath: QWEN_ROOT,
  skillDir: QWEN_SKILLS_DIR,
  managedOutputs: {
    dirs: [QWEN_RULES_DIR, QWEN_COMMANDS_DIR, QWEN_AGENTS_DIR, QWEN_SKILLS_DIR],
    files: [QWEN_ROOT, QWEN_SETTINGS, QWEN_IGNORE],
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

const globalLayout: TargetLayout = {
  rootInstructionPath: QWEN_GLOBAL_ROOT,
  skillDir: QWEN_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [QWEN_GLOBAL_COMMANDS_DIR, QWEN_GLOBAL_AGENTS_DIR, QWEN_GLOBAL_SKILLS_DIR],
    files: [QWEN_GLOBAL_ROOT, QWEN_GLOBAL_SETTINGS],
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
      return null;
    }
    return path;
  },
  paths: {
    rulePath(_slug, _rule) {
      return QWEN_GLOBAL_ROOT;
    },
    commandPath(name) {
      return `${QWEN_GLOBAL_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${QWEN_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'native',
  permissions: 'none',
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: QWEN_CODE_TARGET,
  generators: target,
  capabilities,
  emptyImportMessage:
    'No Qwen Code config found (QWEN.md or .qwen/rules, .qwen/commands, .qwen/settings.json).',
  lintRules,
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      QWEN_GLOBAL_ROOT,
      QWEN_GLOBAL_SETTINGS,
      QWEN_GLOBAL_COMMANDS_DIR,
      QWEN_GLOBAL_AGENTS_DIR,
      QWEN_GLOBAL_SKILLS_DIR,
    ],
    layout: globalLayout,
  },
  importer: {
    rules: [
      {
        feature: 'rules' as const,
        mode: 'singleFile' as const,
        source: {
          project: [QWEN_ROOT],
          global: [QWEN_GLOBAL_ROOT],
        },
        canonicalDir: QWEN_CANONICAL_RULES_DIR,
        canonicalRootFilename: '_root.md',
        markAsRoot: true,
      },
      {
        feature: 'rules' as const,
        mode: 'directory' as const,
        source: {
          project: [QWEN_RULES_DIR],
          global: [],
        },
        canonicalDir: QWEN_CANONICAL_RULES_DIR,
        extensions: ['.md'],
        preset: 'rule' as const,
      },
    ],
    commands: {
      feature: 'commands' as const,
      mode: 'directory' as const,
      source: {
        project: [QWEN_COMMANDS_DIR],
        global: [QWEN_GLOBAL_COMMANDS_DIR],
      },
      canonicalDir: QWEN_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      preset: 'command' as const,
    },
    agents: {
      feature: 'agents' as const,
      mode: 'directory' as const,
      source: {
        project: [QWEN_AGENTS_DIR],
        global: [QWEN_GLOBAL_AGENTS_DIR],
      },
      canonicalDir: QWEN_CANONICAL_AGENTS_DIR,
      extensions: ['.md'],
      preset: 'agent' as const,
    },
    mcp: {
      feature: 'mcp' as const,
      mode: 'mcpJson' as const,
      source: {
        project: [QWEN_SETTINGS],
        global: [QWEN_GLOBAL_SETTINGS],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: '.agentsmesh/mcp.json',
    },
    ignore: {
      feature: 'ignore' as const,
      mode: 'flatFile' as const,
      source: {
        project: [QWEN_IGNORE],
        global: [],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: '.agentsmesh/ignore',
    },
  },
  buildImportPaths: buildQwenCodeImportPaths,
  detectionPaths: [QWEN_ROOT, '.qwen/settings.json', '.qwen/commands', '.qwen/rules'],
} satisfies TargetDescriptor;
