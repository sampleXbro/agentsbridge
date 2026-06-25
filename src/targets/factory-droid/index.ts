/**
 * Factory Droid target descriptor.
 *
 * Generation emits:
 *   - `AGENTS.md`            — root rule + embedded additional rules
 *   - `.factory/skills/`     — skill bundles
 *   - `.factory/droids/`     — native droid definitions from canonical agents
 *   - `.factory/mcp.json`    — MCP servers
 *   - `.factory/hooks.json`  — lifecycle hooks (Claude Code format)
 *
 * Import reads `AGENTS.md`, `.factory/droids/`, `.factory/skills/`, and
 * `.factory/mcp.json`.
 *
 * Factory Droid has native support for agents (droids), skills, MCP, and hooks.
 * Commands are projected as skills. Ignore and permissions have no file-based
 * config — lint warnings are emitted when those canonical features are present.
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
} from './generator.js';
import {
  FACTORY_DROID_TARGET,
  FACTORY_DROID_ROOT_FILE,
  FACTORY_DROID_SKILLS_DIR,
  FACTORY_DROID_DROIDS_DIR,
  FACTORY_DROID_MCP_FILE,
  FACTORY_DROID_HOOKS_FILE,
  FACTORY_DROID_GLOBAL_ROOT_FILE,
  FACTORY_DROID_GLOBAL_SKILLS_DIR,
  FACTORY_DROID_GLOBAL_DROIDS_DIR,
  FACTORY_DROID_GLOBAL_MCP_FILE,
  FACTORY_DROID_GLOBAL_HOOKS_FILE,
  FACTORY_DROID_CANONICAL_RULES_DIR,
  FACTORY_DROID_CANONICAL_AGENTS_DIR,
} from './constants.js';
import { importFromFactoryDroid } from './importer.js';
import { lintRules } from './linter.js';
import { lintPermissions, lintIgnore } from './lint.js';
import { buildFactoryDroidImportPaths } from '../../core/reference/import-map-builders.js';
import { commandSkillDirName } from '../codex-cli/command-skill.js';

export const target: TargetGenerators = {
  name: FACTORY_DROID_TARGET,
  primaryRootInstructionPath: FACTORY_DROID_ROOT_FILE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  importFrom: importFromFactoryDroid,
};

const project: TargetLayout = {
  rootInstructionPath: FACTORY_DROID_ROOT_FILE,
  skillDir: FACTORY_DROID_SKILLS_DIR,
  managedOutputs: {
    dirs: [FACTORY_DROID_SKILLS_DIR, FACTORY_DROID_DROIDS_DIR],
    files: [FACTORY_DROID_ROOT_FILE, FACTORY_DROID_HOOKS_FILE, FACTORY_DROID_MCP_FILE],
  },
  paths: {
    rulePath(_slug) {
      return FACTORY_DROID_ROOT_FILE;
    },
    commandPath(name) {
      return `${FACTORY_DROID_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${FACTORY_DROID_DROIDS_DIR}/${name}.md`;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: FACTORY_DROID_GLOBAL_ROOT_FILE,
  skillDir: FACTORY_DROID_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [FACTORY_DROID_GLOBAL_SKILLS_DIR, FACTORY_DROID_GLOBAL_DROIDS_DIR],
    files: [
      FACTORY_DROID_GLOBAL_ROOT_FILE,
      FACTORY_DROID_GLOBAL_HOOKS_FILE,
      FACTORY_DROID_GLOBAL_MCP_FILE,
    ],
  },
  rewriteGeneratedPath(path) {
    if (path === FACTORY_DROID_ROOT_FILE) return FACTORY_DROID_GLOBAL_ROOT_FILE;
    if (path === FACTORY_DROID_MCP_FILE) return FACTORY_DROID_GLOBAL_MCP_FILE;
    if (path.startsWith(`${FACTORY_DROID_SKILLS_DIR}/`)) {
      return path.replace(`${FACTORY_DROID_SKILLS_DIR}/`, `${FACTORY_DROID_GLOBAL_SKILLS_DIR}/`);
    }
    if (path.startsWith(`${FACTORY_DROID_DROIDS_DIR}/`)) {
      return path.replace(`${FACTORY_DROID_DROIDS_DIR}/`, `${FACTORY_DROID_GLOBAL_DROIDS_DIR}/`);
    }
    return path;
  },
  paths: {
    rulePath(_slug) {
      return FACTORY_DROID_GLOBAL_ROOT_FILE;
    },
    commandPath(name) {
      return `${FACTORY_DROID_GLOBAL_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${FACTORY_DROID_GLOBAL_DROIDS_DIR}/${name}.md`;
    },
  },
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'none',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: FACTORY_DROID_TARGET,
  metadata: {
    displayName: 'Factory Droid',
    category: 'agent-platform',
    officialUrl: 'https://www.factory.ai',
    shortDescription: "Factory.ai's coding droid",
  },
  generators: target,
  capabilities,
  emptyImportMessage:
    'No Factory Droid config found (AGENTS.md, .factory/skills, or .factory/mcp.json).',
  lintRules,
  lint: {
    permissions: lintPermissions,
    ignore: lintIgnore,
  },
  supportsConversion: { commands: true },
  project,
  globalSupport: {
    capabilities,
    detectionPaths: [
      FACTORY_DROID_GLOBAL_ROOT_FILE,
      FACTORY_DROID_GLOBAL_MCP_FILE,
      FACTORY_DROID_GLOBAL_DROIDS_DIR,
    ],
    layout: globalLayout,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'singleFile',
      source: {
        project: [FACTORY_DROID_ROOT_FILE],
        global: [FACTORY_DROID_GLOBAL_ROOT_FILE],
      },
      canonicalDir: FACTORY_DROID_CANONICAL_RULES_DIR,
      canonicalRootFilename: '_root.md',
      markAsRoot: true,
    },
    agents: {
      feature: 'agents',
      mode: 'directory',
      source: {
        project: [FACTORY_DROID_DROIDS_DIR],
        global: [FACTORY_DROID_GLOBAL_DROIDS_DIR],
      },
      canonicalDir: FACTORY_DROID_CANONICAL_AGENTS_DIR,
      extensions: ['.md'],
      preset: 'agent',
    },
  },
  buildImportPaths: buildFactoryDroidImportPaths,
  detectionPaths: [FACTORY_DROID_ROOT_FILE, FACTORY_DROID_MCP_FILE, FACTORY_DROID_DROIDS_DIR],
} satisfies TargetDescriptor;
