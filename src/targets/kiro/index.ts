import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
} from './generator.js';
import { importFromKiro } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks } from './lint.js';
import { buildKiroImportPaths } from '../../core/reference/import-map-builders.js';
import {
  KIRO_TARGET,
  KIRO_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_AGENTS_DIR,
  KIRO_HOOKS_DIR,
  KIRO_MCP_FILE,
  KIRO_IGNORE,
  KIRO_GLOBAL_STEERING_DIR,
  KIRO_GLOBAL_STEERING_AGENTS_MD,
  KIRO_GLOBAL_SKILLS_DIR,
  KIRO_GLOBAL_AGENTS_DIR,
  KIRO_GLOBAL_MCP_FILE,
  KIRO_GLOBAL_IGNORE,
  KIRO_GLOBAL_AGENTS_SKILLS_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: KIRO_TARGET,
  primaryRootInstructionPath: KIRO_AGENTS_MD,
  generateRules,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromKiro,
};

const project: TargetLayout = {
  rootInstructionPath: KIRO_AGENTS_MD,
  skillDir: KIRO_SKILLS_DIR,
  managedOutputs: {
    dirs: ['.kiro/hooks', '.kiro/skills', '.kiro/steering', '.kiro/agents'],
    files: ['AGENTS.md', '.kiro/settings/mcp.json', '.kiroignore'],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${KIRO_STEERING_DIR}/${slug}.md`;
    },
    commandPath(_name, _config) {
      return null;
    },
    agentPath(name, _config) {
      return `${KIRO_AGENTS_DIR}/${name}.md`;
    },
  },
};

const global: TargetLayout = {
  rootInstructionPath: KIRO_GLOBAL_STEERING_AGENTS_MD,
  skillDir: KIRO_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      KIRO_GLOBAL_STEERING_DIR,
      KIRO_GLOBAL_SKILLS_DIR,
      KIRO_GLOBAL_AGENTS_DIR,
      KIRO_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [KIRO_GLOBAL_STEERING_AGENTS_MD, KIRO_GLOBAL_MCP_FILE, KIRO_GLOBAL_IGNORE],
  },
  rewriteGeneratedPath(path) {
    // Transform project-level paths to global ~/.kiro/ paths
    if (path === KIRO_AGENTS_MD) {
      return KIRO_GLOBAL_STEERING_AGENTS_MD;
    }
    if (path.startsWith(`${KIRO_STEERING_DIR}/`)) {
      return path.replace(`${KIRO_STEERING_DIR}/`, `${KIRO_GLOBAL_STEERING_DIR}/`);
    }
    if (path.startsWith(`${KIRO_SKILLS_DIR}/`)) {
      return path.replace(`${KIRO_SKILLS_DIR}/`, `${KIRO_GLOBAL_SKILLS_DIR}/`);
    }
    if (path.startsWith(`${KIRO_AGENTS_DIR}/`)) {
      return path.replace(`${KIRO_AGENTS_DIR}/`, `${KIRO_GLOBAL_AGENTS_DIR}/`);
    }
    if (path === KIRO_MCP_FILE) {
      return KIRO_GLOBAL_MCP_FILE;
    }
    if (path === KIRO_IGNORE) {
      return KIRO_GLOBAL_IGNORE;
    }
    // Skip hooks in global mode
    if (path.startsWith(`${KIRO_HOOKS_DIR}/`)) {
      return null;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    // Mirror ~/.kiro/skills/ to ~/.agents/skills/ unless codex-cli already owns it
    if (path.startsWith('.kiro/skills/') && !activeTargets.includes('codex-cli')) {
      return path.replace(/^\.kiro\/skills\//, '.agents/skills/');
    }
    return null;
  },
  paths: {
    rulePath(slug, _rule) {
      return `${KIRO_GLOBAL_STEERING_DIR}/${slug}.md`;
    },
    commandPath(_name, _config) {
      return null;
    },
    agentPath(name, _config) {
      return `${KIRO_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  commands: 'none',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'native',
  permissions: 'none',
};

export const descriptor = {
  id: KIRO_TARGET,
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'none',
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'native',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Kiro config found (AGENTS.md, .kiro/steering, .kiro/skills, .kiro/agents, .kiro/hooks, .kiro/settings/mcp.json, or .kiroignore).',
  lintRules,
  lint: {
    hooks: lintHooks,
  },
  project,
  global,
  globalCapabilities,
  skillDir: project.skillDir,
  paths: project.paths,
  buildImportPaths: buildKiroImportPaths,
  globalDetectionPaths: [
    KIRO_GLOBAL_STEERING_DIR,
    KIRO_GLOBAL_STEERING_AGENTS_MD,
    KIRO_GLOBAL_SKILLS_DIR,
    KIRO_GLOBAL_AGENTS_DIR,
    KIRO_GLOBAL_MCP_FILE,
    KIRO_GLOBAL_IGNORE,
  ],
  detectionPaths: [
    KIRO_STEERING_DIR,
    KIRO_SKILLS_DIR,
    KIRO_AGENTS_DIR,
    KIRO_HOOKS_DIR,
    KIRO_MCP_FILE,
    KIRO_IGNORE,
  ],
} satisfies TargetDescriptor;
