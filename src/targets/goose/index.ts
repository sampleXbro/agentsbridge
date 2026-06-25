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
  generateMcp,
  generateHooks,
} from './generator.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import { importFromGoose } from './importer.js';
import { gooseImporter } from './importer-spec.js';
import { lintRules } from './linter.js';
import { lintPermissions, lintMcp } from './lint.js';
import { buildGooseImportPaths } from '../../core/reference/import-map-builders.js';
import {
  GOOSE_TARGET,
  GOOSE_ROOT_FILE,
  GOOSE_SKILLS_DIR,
  GOOSE_IGNORE,
  GOOSE_HOOKS_FILE,
  GOOSE_GLOBAL_ROOT_FILE,
  GOOSE_GLOBAL_IGNORE,
  GOOSE_GLOBAL_CONFIG,
  GOOSE_GLOBAL_SKILLS_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: GOOSE_TARGET,
  primaryRootInstructionPath: GOOSE_ROOT_FILE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateIgnore,
  generateMcp,
  generateHooks,
  importFrom: importFromGoose,
};

const project: TargetLayout = {
  rootInstructionPath: GOOSE_ROOT_FILE,
  skillDir: GOOSE_SKILLS_DIR,
  managedOutputs: {
    dirs: [GOOSE_SKILLS_DIR],
    files: [GOOSE_ROOT_FILE, GOOSE_IGNORE, GOOSE_HOOKS_FILE],
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
    files: [GOOSE_GLOBAL_ROOT_FILE, GOOSE_GLOBAL_IGNORE, GOOSE_GLOBAL_CONFIG, GOOSE_HOOKS_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === GOOSE_ROOT_FILE) return GOOSE_GLOBAL_ROOT_FILE;
    if (path === GOOSE_IGNORE) return GOOSE_GLOBAL_IGNORE;
    // Skills: `GOOSE_SKILLS_DIR === GOOSE_GLOBAL_SKILLS_DIR === '.agents/skills'`
    // by design — goose mirrors agents/skills under one path in both scopes.
    // No rewrite needed.
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
  hooks: 'native',
  ignore: 'native',
  permissions: 'none',
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'none',
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'native',
  permissions: 'none',
};

export const descriptor = {
  id: GOOSE_TARGET,
  metadata: {
    displayName: 'Goose',
    category: 'cli',
    officialUrl: 'https://block.github.io/goose',
    shortDescription: "Block's open-source AI agent",
  },
  generators: target,
  capabilities,
  emptyImportMessage: 'No Goose config found (.goosehints, .agents/skills, or .gooseignore).',
  lintRules,
  lint: {
    permissions: lintPermissions,
    mcp: lintMcp,
  },
  supportsConversion: { commands: true, agents: true },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      GOOSE_GLOBAL_ROOT_FILE,
      GOOSE_GLOBAL_IGNORE,
      GOOSE_GLOBAL_SKILLS_DIR,
      GOOSE_GLOBAL_CONFIG,
    ],
    layout: globalLayout,
  },
  importer: gooseImporter,
  sharedArtifacts: {
    '.agents/skills/': 'consumer',
  },
  buildImportPaths: buildGooseImportPaths,
  detectionPaths: [GOOSE_ROOT_FILE, GOOSE_IGNORE],
  conversionDefaults: { commandsToSkills: true, agentsToSkills: true },
} satisfies TargetDescriptor;
