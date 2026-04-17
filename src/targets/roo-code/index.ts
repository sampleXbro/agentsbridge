import type { TargetGenerators, TargetCapabilities } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  generateIgnore,
} from './generator.js';
import {
  ROO_CODE_ROOT_RULE,
  ROO_CODE_RULES_DIR,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_MCP_FILE,
  ROO_CODE_IGNORE,
  ROO_CODE_GLOBAL_RULES_DIR,
  ROO_CODE_GLOBAL_COMMANDS_DIR,
  ROO_CODE_GLOBAL_SKILLS_DIR,
  ROO_CODE_GLOBAL_MCP_FILE,
  ROO_CODE_GLOBAL_IGNORE,
  ROO_CODE_GLOBAL_AGENTS_MD,
  ROO_CODE_GLOBAL_AGENTS_SKILLS_DIR,
} from './constants.js';
import { importFromRooCode } from './importer.js';
import { lintRules } from './linter.js';
import { buildRooCodeImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'roo-code',
  primaryRootInstructionPath: ROO_CODE_ROOT_RULE,
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  generateIgnore,
  importFrom: importFromRooCode,
};

const project: TargetLayout = {
  rootInstructionPath: ROO_CODE_ROOT_RULE,
  skillDir: '.roo/skills',
  managedOutputs: {
    dirs: ['.roo/rules', '.roo/commands', '.roo/skills'],
    files: ['.roo/mcp.json', '.rooignore'],
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

const global: TargetLayout = {
  rootInstructionPath: ROO_CODE_GLOBAL_AGENTS_MD,
  skillDir: ROO_CODE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      ROO_CODE_GLOBAL_RULES_DIR,
      ROO_CODE_GLOBAL_COMMANDS_DIR,
      ROO_CODE_GLOBAL_SKILLS_DIR,
      ROO_CODE_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [ROO_CODE_GLOBAL_AGENTS_MD, ROO_CODE_GLOBAL_MCP_FILE, ROO_CODE_GLOBAL_IGNORE],
  },
  rewriteGeneratedPath(path) {
    // Transform project-level paths to global ~/.roo/ paths
    if (path === ROO_CODE_ROOT_RULE) {
      return ROO_CODE_GLOBAL_AGENTS_MD;
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
    if (path === ROO_CODE_IGNORE) {
      return ROO_CODE_GLOBAL_IGNORE;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    // Mirror ~/.roo/skills/ to ~/.agents/skills/ unless codex-cli already owns it
    if (path.startsWith('.roo/skills/') && !activeTargets.includes('codex-cli')) {
      return path.replace(/^\.roo\/skills\//, '.agents/skills/');
    }
    return null;
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

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  commands: 'native',
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'native',
  permissions: 'none',
};

export const descriptor = {
  id: 'roo-code',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'native',
    agents: 'none',
    skills: 'native',
    mcp: 'native',
    hooks: 'none',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Roo Code config found (.roo/rules, .roo/commands, .roo/skills, .roo/mcp.json, .rooignore, or .roorules).',
  lintRules,
  project,
  global,
  globalCapabilities,
  skillDir: project.skillDir,
  paths: project.paths,
  buildImportPaths: buildRooCodeImportPaths,
  globalDetectionPaths: [
    ROO_CODE_GLOBAL_RULES_DIR,
    ROO_CODE_GLOBAL_COMMANDS_DIR,
    ROO_CODE_GLOBAL_SKILLS_DIR,
    ROO_CODE_GLOBAL_MCP_FILE,
    ROO_CODE_GLOBAL_IGNORE,
    ROO_CODE_GLOBAL_AGENTS_MD,
  ],
  detectionPaths: [
    '.roo/rules',
    '.roo/commands',
    '.roo/skills',
    '.roo/mcp.json',
    '.rooignore',
    '.roorules',
  ],
} satisfies TargetDescriptor;
