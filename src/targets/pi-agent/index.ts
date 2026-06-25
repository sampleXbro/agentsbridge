/**
 * Pi Coding Agent target descriptor.
 *
 * Generation emits:
 *   - `AGENTS.md`        -- root rule + embedded additional rules
 *   - `.pi/prompts/`     -- native prompt templates (slash commands)
 *   - `.pi/skills/`      -- skill bundles
 *
 * Import reads `AGENTS.md`, `.pi/prompts/`, and `.pi/skills/`.
 * Pi also reads `CLAUDE.md` as a fallback but we generate to `AGENTS.md`.
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';
import { generateRules, generateCommands, generateAgents, generateSkills } from './generator.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import { importFromPiAgent } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions, lintIgnore, lintMcp } from './lint.js';
import { buildPiAgentImportPaths } from '../../core/reference/import-maps/pi-agent.js';
import {
  PI_AGENT_TARGET,
  PI_AGENT_ROOT_FILE,
  PI_AGENT_SKILLS_DIR,
  PI_AGENT_COMMANDS_DIR,
  PI_AGENT_GLOBAL_ROOT_FILE,
  PI_AGENT_GLOBAL_SKILLS_DIR,
  PI_AGENT_GLOBAL_COMMANDS_DIR,
  PI_AGENT_CANONICAL_RULES_DIR,
  PI_AGENT_CANONICAL_COMMANDS_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: PI_AGENT_TARGET,
  primaryRootInstructionPath: PI_AGENT_ROOT_FILE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  importFrom: importFromPiAgent,
};

const project: TargetLayout = {
  rootInstructionPath: PI_AGENT_ROOT_FILE,
  skillDir: PI_AGENT_SKILLS_DIR,
  managedOutputs: {
    dirs: [PI_AGENT_SKILLS_DIR, PI_AGENT_COMMANDS_DIR],
    files: [PI_AGENT_ROOT_FILE],
  },
  paths: {
    rulePath(_slug) {
      return PI_AGENT_ROOT_FILE;
    },
    commandPath(name) {
      return `${PI_AGENT_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${PI_AGENT_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: PI_AGENT_GLOBAL_ROOT_FILE,
  skillDir: PI_AGENT_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [PI_AGENT_GLOBAL_SKILLS_DIR, PI_AGENT_GLOBAL_COMMANDS_DIR],
    files: [PI_AGENT_GLOBAL_ROOT_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === PI_AGENT_ROOT_FILE) return PI_AGENT_GLOBAL_ROOT_FILE;
    if (path.startsWith(`${PI_AGENT_COMMANDS_DIR}/`)) {
      return path.replace(`${PI_AGENT_COMMANDS_DIR}/`, `${PI_AGENT_GLOBAL_COMMANDS_DIR}/`);
    }
    if (path.startsWith(`${PI_AGENT_SKILLS_DIR}/`)) {
      return path.replace(`${PI_AGENT_SKILLS_DIR}/`, `${PI_AGENT_GLOBAL_SKILLS_DIR}/`);
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, PI_AGENT_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath(_slug) {
      return PI_AGENT_GLOBAL_ROOT_FILE;
    },
    commandPath(name) {
      return `${PI_AGENT_GLOBAL_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${PI_AGENT_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'native',
  agents: 'none',
  skills: 'native',
  mcp: 'none',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: PI_AGENT_TARGET,
  metadata: {
    displayName: 'Pi Agent',
    category: 'cli',
    officialUrl: 'https://github.com/earendil-works/pi',
    shortDescription: 'Pi coding agent',
  },
  generators: target,
  capabilities,
  emptyImportMessage: 'No Pi Coding Agent config found (AGENTS.md or .pi/skills).',
  lintRules,
  lint: {
    hooks: lintHooks,
    permissions: lintPermissions,
    ignore: lintIgnore,
    mcp: lintMcp,
  },
  supportsConversion: { agents: true },
  project,
  globalSupport: {
    capabilities,
    detectionPaths: [PI_AGENT_GLOBAL_ROOT_FILE],
    layout: globalLayout,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'singleFile',
      source: {
        project: [PI_AGENT_ROOT_FILE],
        global: [PI_AGENT_GLOBAL_ROOT_FILE],
      },
      canonicalDir: PI_AGENT_CANONICAL_RULES_DIR,
      canonicalRootFilename: '_root.md',
      markAsRoot: true,
    },
    commands: {
      feature: 'commands',
      mode: 'directory',
      source: {
        project: [PI_AGENT_COMMANDS_DIR],
        global: [PI_AGENT_GLOBAL_COMMANDS_DIR],
      },
      canonicalDir: PI_AGENT_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      preset: 'command',
    },
  },
  sharedArtifacts: {
    '.agents/skills/': 'consumer',
  },
  buildImportPaths: buildPiAgentImportPaths,
  detectionPaths: [PI_AGENT_ROOT_FILE, PI_AGENT_SKILLS_DIR],
} satisfies TargetDescriptor;
