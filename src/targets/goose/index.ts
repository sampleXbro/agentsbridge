/**
 * Goose target descriptor.
 *
 * Generation emits:
 *   - `.goosehints`       — root rule + embedded additional rules
 *   - `.agents/skills/`   — skill bundles
 *   - `.gooseignore`      — ignore patterns
 *
 * Import reads `.goosehints`, `.agents/skills/`, and `.gooseignore`.
 * Goose also reads `AGENTS.md` but we generate to the native `.goosehints`
 * path to avoid shared-artifact collisions with other targets.
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
  generateIgnore,
} from './generator.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import { importFromGoose } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions, lintMcp } from './lint.js';
import { buildGooseImportPaths } from '../../core/reference/import-map-builders.js';
import {
  GOOSE_TARGET,
  GOOSE_ROOT_FILE,
  GOOSE_SKILLS_DIR,
  GOOSE_IGNORE,
  GOOSE_GLOBAL_ROOT_FILE,
  GOOSE_GLOBAL_IGNORE,
  GOOSE_GLOBAL_SKILLS_DIR,
  GOOSE_CANONICAL_RULES_DIR,
  GOOSE_CANONICAL_IGNORE,
} from './constants.js';

export const target: TargetGenerators = {
  name: GOOSE_TARGET,
  primaryRootInstructionPath: GOOSE_ROOT_FILE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateIgnore,
  importFrom: importFromGoose,
};

const project: TargetLayout = {
  rootInstructionPath: GOOSE_ROOT_FILE,
  skillDir: GOOSE_SKILLS_DIR,
  managedOutputs: {
    dirs: [GOOSE_SKILLS_DIR],
    files: [GOOSE_ROOT_FILE, GOOSE_IGNORE],
  },
  paths: {
    rulePath(_slug) {
      return GOOSE_ROOT_FILE;
    },
    commandPath(name) {
      return `${GOOSE_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${GOOSE_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: GOOSE_GLOBAL_ROOT_FILE,
  skillDir: GOOSE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [GOOSE_GLOBAL_SKILLS_DIR],
    files: [GOOSE_GLOBAL_ROOT_FILE, GOOSE_GLOBAL_IGNORE],
  },
  rewriteGeneratedPath(path) {
    if (path === GOOSE_ROOT_FILE) return GOOSE_GLOBAL_ROOT_FILE;
    if (path === GOOSE_IGNORE) return GOOSE_GLOBAL_IGNORE;
    if (path.startsWith(`${GOOSE_SKILLS_DIR}/`)) {
      return path;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, GOOSE_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath(_slug) {
      return GOOSE_GLOBAL_ROOT_FILE;
    },
    commandPath(name) {
      return `${GOOSE_GLOBAL_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${GOOSE_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'none',
  agents: 'none',
  skills: 'native',
  mcp: 'none',
  hooks: 'none',
  ignore: 'native',
  permissions: 'none',
};

export const descriptor = {
  id: GOOSE_TARGET,
  generators: target,
  capabilities,
  emptyImportMessage: 'No Goose config found (.goosehints, .agents/skills, or .gooseignore).',
  lintRules,
  lint: {
    hooks: lintHooks,
    permissions: lintPermissions,
    mcp: lintMcp,
  },
  supportsConversion: { commands: true, agents: true },
  project,
  globalSupport: {
    capabilities,
    detectionPaths: [GOOSE_GLOBAL_ROOT_FILE, GOOSE_GLOBAL_IGNORE, GOOSE_GLOBAL_SKILLS_DIR],
    layout: globalLayout,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'singleFile',
      source: {
        project: [GOOSE_ROOT_FILE],
        global: [GOOSE_GLOBAL_ROOT_FILE],
      },
      canonicalDir: GOOSE_CANONICAL_RULES_DIR,
      canonicalRootFilename: '_root.md',
      markAsRoot: true,
    },
    ignore: {
      feature: 'ignore',
      mode: 'flatFile',
      source: {
        project: [GOOSE_IGNORE],
        global: [GOOSE_GLOBAL_IGNORE],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: GOOSE_CANONICAL_IGNORE,
    },
  },
  sharedArtifacts: {
    '.agents/skills/': 'consumer',
  },
  buildImportPaths: buildGooseImportPaths,
  detectionPaths: [GOOSE_ROOT_FILE, GOOSE_IGNORE],
} satisfies TargetDescriptor;
