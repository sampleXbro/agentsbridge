/**
 * Qwen Code target descriptor.
 * Config: `.qwen/` (project), `~/.qwen/` (global).
 * settings.json holds MCP, hooks, and permissions (merged via mergeGeneratedOutputContent).
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout, GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateHooks,
  generatePermissions,
  renderQwenGlobalInstructions,
} from './generator.js';
import { importFromQwenCode } from './importer.js';
import { lintRules } from './linter.js';
import { buildQwenCodeImportPaths } from '../../core/reference/import-map-builders.js';
import { qwenCodeImporterSpec } from './importer-spec.js';
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
  generateHooks,
  generatePermissions,
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
  renderPrimaryRootInstruction: renderQwenGlobalInstructions,
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
  hooks: 'native',
  ignore: 'native',
  permissions: 'native',
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'none',
  permissions: 'native',
};

function parseJsonObject(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    const p: unknown = JSON.parse(s);
    return p !== null && typeof p === 'object' && !Array.isArray(p)
      ? (p as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

const mergeQwenSettings: GeneratedOutputMerger = (existing, pending, newContent, resolvedPath) => {
  if (resolvedPath !== QWEN_SETTINGS && resolvedPath !== QWEN_GLOBAL_SETTINGS) return null;
  // Use in-memory pending result as base (preferred over stale disk content)
  const base = parseJsonObject(pending?.content ?? existing);
  try {
    const incoming = JSON.parse(newContent) as Record<string, unknown>;
    if (incoming.mcpServers !== undefined) base.mcpServers = incoming.mcpServers;
    if (incoming.hooks !== undefined) base.hooks = incoming.hooks;
    if (incoming.permissions !== undefined) base.permissions = incoming.permissions;
  } catch {
    return pending?.content ?? existing ?? newContent;
  }
  return JSON.stringify(base, null, 2);
};

export const descriptor = {
  id: QWEN_CODE_TARGET,
  metadata: {
    displayName: 'Qwen Code',
    category: 'cli',
    officialUrl: 'https://github.com/QwenLM/qwen-code',
    shortDescription: "Alibaba's Qwen coding CLI",
  },
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
  mergeGeneratedOutputContent: mergeQwenSettings,
  importer: qwenCodeImporterSpec,
  buildImportPaths: buildQwenCodeImportPaths,
  detectionPaths: [QWEN_ROOT, '.qwen/settings.json', '.qwen/commands', '.qwen/rules'],
} satisfies TargetDescriptor;
