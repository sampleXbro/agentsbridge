/**
 * Rovo Dev target descriptor.
 *
 * Generation emits:
 *   - `AGENTS.md`          — root rule + embedded additional rules
 *   - `.rovodev/skills/`   — skill bundles (+ projected commands/agents)
 *   - `.rovodev/mcp.json`  — MCP servers
 *
 * Import reads `AGENTS.md`, `.rovodev/skills/`, and `.rovodev/mcp.json`.
 *
 * Global mode reads/writes `~/.rovodev/AGENTS.md`, `~/.rovodev/skills/`,
 * and `~/.rovodev/mcp.json`.
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { commandSkillDirName } from '../codex-cli/command-skill.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
} from './generator.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import { importFromRovodev } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions, lintIgnore } from './lint.js';
import { buildRovodevImportPaths } from '../../core/reference/import-map-builders.js';
import {
  ROVODEV_TARGET,
  ROVODEV_ROOT_FILE,
  ROVODEV_SKILLS_DIR,
  ROVODEV_MCP_FILE,
  ROVODEV_GLOBAL_DIR,
  ROVODEV_GLOBAL_ROOT_FILE,
  ROVODEV_GLOBAL_SKILLS_DIR,
  ROVODEV_GLOBAL_MCP_FILE,
  ROVODEV_CANONICAL_RULES_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: ROVODEV_TARGET,
  primaryRootInstructionPath: ROVODEV_ROOT_FILE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  importFrom: importFromRovodev,
};

const project: TargetLayout = {
  rootInstructionPath: ROVODEV_ROOT_FILE,
  skillDir: ROVODEV_SKILLS_DIR,
  managedOutputs: {
    dirs: [ROVODEV_SKILLS_DIR],
    files: [ROVODEV_ROOT_FILE, ROVODEV_MCP_FILE],
  },
  paths: {
    rulePath(_slug) {
      return ROVODEV_ROOT_FILE;
    },
    commandPath(name) {
      return `${ROVODEV_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${ROVODEV_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: ROVODEV_GLOBAL_ROOT_FILE,
  skillDir: ROVODEV_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [ROVODEV_GLOBAL_SKILLS_DIR],
    files: [ROVODEV_GLOBAL_ROOT_FILE, ROVODEV_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === ROVODEV_ROOT_FILE) return ROVODEV_GLOBAL_ROOT_FILE;
    if (path.startsWith(`${ROVODEV_SKILLS_DIR}/`)) {
      return path.replace(`${ROVODEV_SKILLS_DIR}/`, `${ROVODEV_GLOBAL_SKILLS_DIR}/`);
    }
    if (path === ROVODEV_MCP_FILE) return ROVODEV_GLOBAL_MCP_FILE;
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, ROVODEV_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath(_slug) {
      return ROVODEV_GLOBAL_ROOT_FILE;
    },
    commandPath(name) {
      return `${ROVODEV_GLOBAL_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${ROVODEV_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'none',
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'none',
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: ROVODEV_TARGET,
  generators: target,
  capabilities,
  emptyImportMessage:
    'No Rovo Dev config found (AGENTS.md, .rovodev/skills, or .rovodev/mcp.json).',
  lintRules,
  lint: {
    hooks: lintHooks,
    permissions: lintPermissions,
    ignore: lintIgnore,
  },
  supportsConversion: { commands: true, agents: true },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [ROVODEV_GLOBAL_DIR, ROVODEV_GLOBAL_ROOT_FILE, ROVODEV_GLOBAL_SKILLS_DIR],
    layout: globalLayout,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'singleFile',
      source: {
        project: [ROVODEV_ROOT_FILE],
        global: [ROVODEV_GLOBAL_ROOT_FILE],
      },
      canonicalDir: ROVODEV_CANONICAL_RULES_DIR,
      canonicalRootFilename: '_root.md',
      markAsRoot: true,
    },
    mcp: {
      feature: 'mcp',
      mode: 'mcpJson',
      source: {
        project: [ROVODEV_MCP_FILE],
        global: [ROVODEV_GLOBAL_MCP_FILE],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: 'mcp.json',
    },
  },
  buildImportPaths: buildRovodevImportPaths,
  detectionPaths: [ROVODEV_ROOT_FILE, ROVODEV_SKILLS_DIR, ROVODEV_MCP_FILE],
} satisfies TargetDescriptor;
