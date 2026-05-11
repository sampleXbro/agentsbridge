/**
 * Deep Agents CLI target descriptor.
 *
 * Generation emits:
 *   - `.deepagents/AGENTS.md`  — root rule + embedded additional rules
 *   - `.deepagents/skills/`    — skill bundles
 *   - `.mcp.json`              — MCP servers (standard format)
 *
 * Import reads `.deepagents/AGENTS.md`, `.deepagents/skills/`, and `.mcp.json`.
 *
 * Deep Agents CLI uses `.deepagents/AGENTS.md` (not root `AGENTS.md`) to
 * avoid collision with Amp, Codex CLI, and Warp which share root `AGENTS.md`.
 *
 * Global mode generates to `~/.deepagents/` (AGENTS.md, skills/, .mcp.json).
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
import { importFromDeepagentsCli } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions, lintIgnore } from './lint.js';
import { buildDeepagentsCliImportPaths } from '../../core/reference/import-map-builders.js';
import {
  DEEPAGENTS_CLI_TARGET,
  DEEPAGENTS_CLI_ROOT_FILE,
  DEEPAGENTS_CLI_SKILLS_DIR,
  DEEPAGENTS_CLI_MCP_FILE,
  DEEPAGENTS_CLI_GLOBAL_ROOT_FILE,
  DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR,
  DEEPAGENTS_CLI_GLOBAL_MCP_FILE,
  DEEPAGENTS_CLI_CANONICAL_RULES_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: DEEPAGENTS_CLI_TARGET,
  primaryRootInstructionPath: DEEPAGENTS_CLI_ROOT_FILE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  importFrom: importFromDeepagentsCli,
};

const project: TargetLayout = {
  rootInstructionPath: DEEPAGENTS_CLI_ROOT_FILE,
  skillDir: DEEPAGENTS_CLI_SKILLS_DIR,
  managedOutputs: {
    dirs: [DEEPAGENTS_CLI_SKILLS_DIR],
    files: [DEEPAGENTS_CLI_ROOT_FILE, DEEPAGENTS_CLI_MCP_FILE],
  },
  paths: {
    rulePath(_slug) {
      return DEEPAGENTS_CLI_ROOT_FILE;
    },
    commandPath(name) {
      return `${DEEPAGENTS_CLI_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${DEEPAGENTS_CLI_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: DEEPAGENTS_CLI_GLOBAL_ROOT_FILE,
  skillDir: DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR],
    files: [DEEPAGENTS_CLI_GLOBAL_ROOT_FILE, DEEPAGENTS_CLI_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === DEEPAGENTS_CLI_ROOT_FILE) return DEEPAGENTS_CLI_GLOBAL_ROOT_FILE;
    if (path === DEEPAGENTS_CLI_MCP_FILE) return DEEPAGENTS_CLI_GLOBAL_MCP_FILE;
    if (path.startsWith(`${DEEPAGENTS_CLI_SKILLS_DIR}/`)) {
      return path.replace(`${DEEPAGENTS_CLI_SKILLS_DIR}/`, `${DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR}/`);
    }
    return path;
  },
  paths: {
    rulePath(_slug) {
      return DEEPAGENTS_CLI_GLOBAL_ROOT_FILE;
    },
    commandPath(name) {
      return `${DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
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
  id: DEEPAGENTS_CLI_TARGET,
  metadata: {
    displayName: 'Deep Agents CLI',
    category: 'cli',
    officialUrl: 'https://github.com/langchain-ai/deepagents',
    shortDescription: 'LangChain Deep Agents framework CLI',
  },
  generators: target,
  capabilities,
  emptyImportMessage:
    'No Deep Agents CLI config found (.deepagents/AGENTS.md, .deepagents/skills, or .mcp.json).',
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
    detectionPaths: [DEEPAGENTS_CLI_GLOBAL_ROOT_FILE, DEEPAGENTS_CLI_GLOBAL_MCP_FILE],
    layout: globalLayout,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'singleFile',
      source: {
        project: [DEEPAGENTS_CLI_ROOT_FILE],
        global: [DEEPAGENTS_CLI_GLOBAL_ROOT_FILE],
      },
      canonicalDir: DEEPAGENTS_CLI_CANONICAL_RULES_DIR,
      canonicalRootFilename: '_root.md',
      markAsRoot: true,
    },
    mcp: {
      feature: 'mcp',
      mode: 'mcpJson',
      source: {
        project: [DEEPAGENTS_CLI_MCP_FILE],
        global: [DEEPAGENTS_CLI_GLOBAL_MCP_FILE],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: 'mcp.json',
    },
  },
  buildImportPaths: buildDeepagentsCliImportPaths,
  detectionPaths: [DEEPAGENTS_CLI_ROOT_FILE, DEEPAGENTS_CLI_MCP_FILE],
} satisfies TargetDescriptor;
