import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  renderJunieGlobalInstructions,
} from './generator.js';
import {
  JUNIE_DOT_AGENTS,
  JUNIE_RULES_DIR,
  JUNIE_COMMANDS_DIR,
  JUNIE_AGENTS_DIR,
  JUNIE_MCP_FILE,
  JUNIE_IGNORE,
  JUNIE_GLOBAL_AGENTS_MD,
  JUNIE_GLOBAL_SKILLS_DIR,
  JUNIE_GLOBAL_AGENTS_DIR,
  JUNIE_GLOBAL_COMMANDS_DIR,
  JUNIE_GLOBAL_MCP_FILE,
  JUNIE_GLOBAL_AGENTS_SKILLS_DIR,
  JUNIE_SKILLS_DIR,
} from './constants.js';
import { importFromJunie } from './importer.js';
import { lintRules } from './linter.js';
import { buildJunieImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'junie',
  primaryRootInstructionPath: JUNIE_DOT_AGENTS,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  importFrom: importFromJunie,
};

const project: TargetLayout = {
  rootInstructionPath: JUNIE_DOT_AGENTS,
  skillDir: '.junie/skills',
  managedOutputs: {
    dirs: ['.junie/agents', '.junie/commands', '.junie/rules', '.junie/skills'],
    files: ['.aiignore', '.junie/AGENTS.md', '.junie/mcp/mcp.json'],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${JUNIE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${JUNIE_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name, _config) {
      return `${JUNIE_AGENTS_DIR}/${name}.md`;
    },
  },
};

const global: TargetLayout = {
  rootInstructionPath: JUNIE_GLOBAL_AGENTS_MD,
  renderPrimaryRootInstruction: renderJunieGlobalInstructions,
  skillDir: JUNIE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      JUNIE_GLOBAL_SKILLS_DIR,
      JUNIE_GLOBAL_AGENTS_DIR,
      JUNIE_GLOBAL_COMMANDS_DIR,
      JUNIE_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [JUNIE_GLOBAL_AGENTS_MD, JUNIE_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path) {
    // Transform project-level paths to global ~/.junie/ paths
    if (path === JUNIE_DOT_AGENTS) {
      return JUNIE_GLOBAL_AGENTS_MD;
    }
    if (path.startsWith(`${JUNIE_RULES_DIR}/`)) {
      return JUNIE_GLOBAL_AGENTS_MD; // Aggregate all rules into AGENTS.md
    }
    if (path.startsWith(`${JUNIE_SKILLS_DIR}/`)) {
      return path.replace(`${JUNIE_SKILLS_DIR}/`, `${JUNIE_GLOBAL_SKILLS_DIR}/`);
    }
    if (path.startsWith(`${JUNIE_COMMANDS_DIR}/`)) {
      return path.replace(`${JUNIE_COMMANDS_DIR}/`, `${JUNIE_GLOBAL_COMMANDS_DIR}/`);
    }
    if (path.startsWith(`${JUNIE_AGENTS_DIR}/`)) {
      return path.replace(`${JUNIE_AGENTS_DIR}/`, `${JUNIE_GLOBAL_AGENTS_DIR}/`);
    }
    if (path === JUNIE_MCP_FILE) {
      return JUNIE_GLOBAL_MCP_FILE;
    }
    // .aiignore is not generated in global mode per the spec
    if (path === JUNIE_IGNORE) {
      return null;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    // Mirror ~/.junie/skills/ to ~/.agents/skills/ unless codex-cli already owns it
    if (path.startsWith('.junie/skills/') && !activeTargets.includes('codex-cli')) {
      return path.replace(/^\.junie\/skills\//, '.agents/skills/');
    }
    return null;
  },
  paths: {
    rulePath(_slug, _rule) {
      return JUNIE_GLOBAL_AGENTS_MD; // All rules go to AGENTS.md
    },
    commandPath(name, _config) {
      return `${JUNIE_GLOBAL_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name, _config) {
      return `${JUNIE_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: 'junie',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'embedded',
    agents: 'embedded',
    skills: 'embedded',
    mcp: 'native',
    hooks: 'none',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Junie config found (.junie/guidelines.md, .junie/AGENTS.md, .junie/skills, .junie/mcp/mcp.json, or .aiignore).',
  lintRules,
  project,
  global,
  globalCapabilities,
  skillDir: project.skillDir,
  paths: project.paths,
  buildImportPaths: buildJunieImportPaths,
  globalDetectionPaths: [
    JUNIE_GLOBAL_AGENTS_MD,
    JUNIE_GLOBAL_SKILLS_DIR,
    JUNIE_GLOBAL_AGENTS_DIR,
    JUNIE_GLOBAL_COMMANDS_DIR,
    JUNIE_GLOBAL_MCP_FILE,
  ],
  detectionPaths: [
    '.junie/guidelines.md',
    '.junie/AGENTS.md',
    '.junie/skills',
    '.junie/mcp/mcp.json',
    '.aiignore',
  ],
} satisfies TargetDescriptor;
