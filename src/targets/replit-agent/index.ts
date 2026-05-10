/**
 * Replit Agent target descriptor.
 *
 * Generation emits:
 *   - `replit.md`          — root rule + embedded additional rules
 *   - `.agents/skills/`    — skill bundles
 *
 * Import reads `replit.md` and `.agents/skills/`.
 *
 * Replit Agent is cloud-only — there is no global (user-level) config.
 * MCP servers are configured via the Replit Integrations UI, not files.
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { commandSkillDirName } from '../codex-cli/command-skill.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';
import { generateRules, generateCommands, generateAgents, generateSkills } from './generator.js';
import { importFromReplitAgent } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions, lintIgnore, lintMcp } from './lint.js';
import { buildReplitAgentImportPaths } from '../../core/reference/import-maps/replit-agent.js';
import {
  REPLIT_AGENT_TARGET,
  REPLIT_AGENT_ROOT_FILE,
  REPLIT_AGENT_SKILLS_DIR,
  REPLIT_AGENT_CANONICAL_RULES_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: REPLIT_AGENT_TARGET,
  primaryRootInstructionPath: REPLIT_AGENT_ROOT_FILE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  importFrom: importFromReplitAgent,
};

const project: TargetLayout = {
  rootInstructionPath: REPLIT_AGENT_ROOT_FILE,
  skillDir: REPLIT_AGENT_SKILLS_DIR,
  managedOutputs: {
    dirs: [REPLIT_AGENT_SKILLS_DIR],
    files: [REPLIT_AGENT_ROOT_FILE],
  },
  paths: {
    rulePath(_slug) {
      return REPLIT_AGENT_ROOT_FILE;
    },
    commandPath(name) {
      return `${REPLIT_AGENT_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${REPLIT_AGENT_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
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
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: REPLIT_AGENT_TARGET,
  generators: target,
  capabilities,
  emptyImportMessage: 'No Replit Agent config found (replit.md or .agents/skills).',
  lintRules,
  lint: {
    hooks: lintHooks,
    permissions: lintPermissions,
    ignore: lintIgnore,
    mcp: lintMcp,
  },
  supportsConversion: { commands: true, agents: true },
  project,
  sharedArtifacts: {
    '.agents/skills/': 'consumer',
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'singleFile',
      source: {
        project: [REPLIT_AGENT_ROOT_FILE],
      },
      canonicalDir: REPLIT_AGENT_CANONICAL_RULES_DIR,
      canonicalRootFilename: '_root.md',
      markAsRoot: true,
    },
  },
  buildImportPaths: buildReplitAgentImportPaths,
  detectionPaths: [REPLIT_AGENT_ROOT_FILE],
} satisfies TargetDescriptor;
