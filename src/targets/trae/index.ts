import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateCommands,
} from './generator.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import { importFromTrae } from './importer.js';
import { lintRules } from './linter.js';
import { buildTraeImportPaths } from '../../core/reference/import-map-builders.js';
import {
  TRAE_TARGET,
  TRAE_PROJECT_RULES,
  TRAE_RULES_DIR,
  TRAE_COMMANDS_DIR,
  TRAE_GLOBAL_COMMANDS_DIR,
  TRAE_SKILLS_DIR,
  TRAE_MCP_FILE,
  TRAE_IGNORE,
  TRAE_GLOBAL_RULES_DIR,
  TRAE_GLOBAL_ROOT_RULE,
  TRAE_GLOBAL_SKILLS_DIR,
  TRAE_GLOBAL_MCP_FILE,
  TRAE_GLOBAL_AGENTS_SKILLS_DIR,
  TRAE_CANONICAL_COMMANDS_DIR,
  TRAE_CANONICAL_MCP,
  TRAE_CANONICAL_IGNORE,
} from './constants.js';

export const target: TargetGenerators = {
  name: TRAE_TARGET,
  primaryRootInstructionPath: TRAE_PROJECT_RULES,
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  generateIgnore,
  importFrom: importFromTrae,
};

const project: TargetLayout = {
  rootInstructionPath: TRAE_PROJECT_RULES,
  skillDir: TRAE_SKILLS_DIR,
  managedOutputs: {
    dirs: [TRAE_RULES_DIR, TRAE_COMMANDS_DIR, TRAE_SKILLS_DIR],
    files: [TRAE_MCP_FILE, TRAE_IGNORE],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${TRAE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${TRAE_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(_name, _config) {
      // Trae agents are UI-driven; no file-based config format
      return null;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: TRAE_GLOBAL_ROOT_RULE,
  skillDir: TRAE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      TRAE_GLOBAL_RULES_DIR,
      TRAE_GLOBAL_COMMANDS_DIR,
      TRAE_GLOBAL_SKILLS_DIR,
      TRAE_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [TRAE_GLOBAL_ROOT_RULE, TRAE_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path) {
    // Transform .trae/rules/project_rules.md → .trae/user_rules/rules.md
    if (path === TRAE_PROJECT_RULES) {
      return TRAE_GLOBAL_ROOT_RULE;
    }
    // Transform .trae/rules/<slug>.md → .trae/user_rules/<slug>.md
    if (path.startsWith(`${TRAE_RULES_DIR}/`)) {
      return path.replace(`${TRAE_RULES_DIR}/`, `${TRAE_GLOBAL_RULES_DIR}/`);
    }
    // Transform .trae/skills/<name>/ → .trae/skills/<name>/
    if (path.startsWith(`${TRAE_SKILLS_DIR}/`)) {
      return path.replace(`${TRAE_SKILLS_DIR}/`, `${TRAE_GLOBAL_SKILLS_DIR}/`);
    }
    // Transform .trae/mcp.json → .trae/mcp.json
    if (path === TRAE_MCP_FILE) {
      return TRAE_GLOBAL_MCP_FILE;
    }
    // Suppress project ignore in global mode
    if (path === TRAE_IGNORE) {
      return null;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, TRAE_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath(slug, _rule) {
      if (slug === '_root') return TRAE_GLOBAL_ROOT_RULE;
      return `${TRAE_GLOBAL_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${TRAE_GLOBAL_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(_name, _config) {
      // Trae agents are UI-driven; no file-based config format
      return null;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: TRAE_TARGET,
  metadata: {
    displayName: 'Trae',
    category: 'ide',
    officialUrl: 'https://www.trae.ai',
    shortDescription: "ByteDance's adaptive AI IDE",
  },
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'native',
    commands: 'native',
    agents: 'none',
    skills: 'native',
    mcp: 'native',
    hooks: 'none',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Trae config found (.trae/rules/project_rules.md, .trae/rules/*.md, .trae/skills/, .trae/mcp.json, or .trae/.ignore).',
  lintRules,
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      TRAE_GLOBAL_ROOT_RULE,
      TRAE_GLOBAL_RULES_DIR,
      TRAE_GLOBAL_SKILLS_DIR,
      TRAE_GLOBAL_MCP_FILE,
    ],
    layout: globalLayout,
  },
  importer: {
    commands: {
      feature: 'commands',
      mode: 'directory',
      source: {
        project: [TRAE_COMMANDS_DIR],
        global: [TRAE_GLOBAL_COMMANDS_DIR],
      },
      canonicalDir: TRAE_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      preset: 'command',
    },
    mcp: {
      feature: 'mcp',
      mode: 'mcpJson',
      source: { project: [TRAE_MCP_FILE], global: [TRAE_GLOBAL_MCP_FILE] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: TRAE_CANONICAL_MCP,
    },
    ignore: {
      feature: 'ignore',
      mode: 'flatFile',
      source: { project: [TRAE_IGNORE] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: TRAE_CANONICAL_IGNORE,
    },
  },
  buildImportPaths: buildTraeImportPaths,
  detectionPaths: [TRAE_RULES_DIR, TRAE_MCP_FILE, TRAE_PROJECT_RULES],
} satisfies TargetDescriptor;
