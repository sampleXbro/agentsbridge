/**
 * Warp target descriptor.
 *
 * Generation emits:
 *   - `AGENTS.md`        — root rule + embedded additional rules
 *   - `.warp/skills/`    — skill bundles
 *   - `.mcp.json`        — MCP servers (standard format)
 *
 * Import reads `WARP.md` (legacy, higher priority), `AGENTS.md`,
 * `.warp/skills/`, and `.mcp.json`.
 *
 * Global mode supports skills only — Warp's global rules are
 * UI-managed via Warp Drive, not file-based.
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
import { importFromWarp } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions, lintIgnore } from './lint.js';
import { buildWarpImportPaths } from '../../core/reference/import-map-builders.js';
import {
  WARP_TARGET,
  WARP_ROOT_FILE,
  WARP_LEGACY_ROOT_FILE,
  WARP_SKILLS_DIR,
  WARP_MCP_FILE,
  WARP_GLOBAL_SKILLS_DIR,
  WARP_CANONICAL_RULES_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: WARP_TARGET,
  primaryRootInstructionPath: WARP_ROOT_FILE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  importFrom: importFromWarp,
};

const project: TargetLayout = {
  rootInstructionPath: WARP_ROOT_FILE,
  skillDir: WARP_SKILLS_DIR,
  managedOutputs: {
    dirs: [WARP_SKILLS_DIR],
    files: [WARP_ROOT_FILE, WARP_MCP_FILE],
  },
  paths: {
    rulePath(_slug) {
      return WARP_ROOT_FILE;
    },
    commandPath(name) {
      return `${WARP_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${WARP_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: undefined,
  skillDir: WARP_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [WARP_GLOBAL_SKILLS_DIR],
    files: [],
  },
  rewriteGeneratedPath(path) {
    if (path.startsWith(`${WARP_SKILLS_DIR}/`)) {
      return path.replace(`${WARP_SKILLS_DIR}/`, `${WARP_GLOBAL_SKILLS_DIR}/`);
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, WARP_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath() {
      return WARP_GLOBAL_SKILLS_DIR;
    },
    commandPath(name) {
      return `${WARP_GLOBAL_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${WARP_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
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
  rules: 'none',
  additionalRules: 'none',
  commands: 'none',
  agents: 'none',
  skills: 'native',
  mcp: 'none',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: WARP_TARGET,
  generators: target,
  capabilities,
  emptyImportMessage: 'No Warp config found (WARP.md, AGENTS.md, .warp/skills, or .mcp.json).',
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
    detectionPaths: [WARP_GLOBAL_SKILLS_DIR],
    layout: globalLayout,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'singleFile',
      source: {
        project: [WARP_LEGACY_ROOT_FILE, WARP_ROOT_FILE],
      },
      canonicalDir: WARP_CANONICAL_RULES_DIR,
      canonicalRootFilename: '_root.md',
      markAsRoot: true,
    },
    mcp: {
      feature: 'mcp',
      mode: 'mcpJson',
      source: {
        project: [WARP_MCP_FILE],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: 'mcp.json',
    },
  },
  buildImportPaths: buildWarpImportPaths,
  detectionPaths: [WARP_ROOT_FILE, WARP_LEGACY_ROOT_FILE, WARP_MCP_FILE],
} satisfies TargetDescriptor;
