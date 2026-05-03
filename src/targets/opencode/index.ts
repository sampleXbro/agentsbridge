/**
 * OpenCode target descriptor.
 *
 * Generation emits:
 *   - `AGENTS.md`                    — root rule
 *   - `.opencode/rules/<slug>.md`    — additional rules
 *   - `.opencode/commands/<name>.md` — slash commands
 *   - `.opencode/agents/<slug>.md`   — custom agents
 *   - `.opencode/skills/`            — skill bundles
 *   - `opencode.json`               — MCP servers under `mcp` key
 *
 * Import reads both `AGENTS.md` and `.opencode/` directory structure.
 * OpenCode also reads `CLAUDE.md` as a fallback, but we import from
 * the canonical `AGENTS.md` path only.
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
} from './generator.js';
import {
  OPENCODE_TARGET,
  OPENCODE_ROOT_RULE,
  OPENCODE_RULES_DIR,
  OPENCODE_COMMANDS_DIR,
  OPENCODE_AGENTS_DIR,
  OPENCODE_SKILLS_DIR,
  OPENCODE_CONFIG_FILE,
  OPENCODE_GLOBAL_AGENTS_MD,
  OPENCODE_GLOBAL_RULES_DIR,
  OPENCODE_GLOBAL_COMMANDS_DIR,
  OPENCODE_GLOBAL_AGENTS_DIR,
  OPENCODE_GLOBAL_SKILLS_DIR,
  OPENCODE_GLOBAL_CONFIG_FILE,
  OPENCODE_GLOBAL_AGENTS_SKILLS_DIR,
  OPENCODE_CANONICAL_RULES_DIR,
  OPENCODE_CANONICAL_COMMANDS_DIR,
  OPENCODE_CANONICAL_AGENTS_DIR,
} from './constants.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import { importFromOpenCode } from './importer.js';
import {
  opencodeAgentMapper,
  opencodeCommandMapper,
  opencodeNonRootRuleMapper,
} from './import-mappers.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions, lintIgnore } from './lint.js';
import { buildOpencodeImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: OPENCODE_TARGET,
  primaryRootInstructionPath: OPENCODE_ROOT_RULE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  importFrom: importFromOpenCode,
};

const project: TargetLayout = {
  rootInstructionPath: OPENCODE_ROOT_RULE,
  skillDir: OPENCODE_SKILLS_DIR,
  managedOutputs: {
    dirs: [OPENCODE_RULES_DIR, OPENCODE_COMMANDS_DIR, OPENCODE_AGENTS_DIR, OPENCODE_SKILLS_DIR],
    files: [OPENCODE_ROOT_RULE, OPENCODE_CONFIG_FILE],
  },
  paths: {
    rulePath(slug) {
      return `${OPENCODE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name) {
      return `${OPENCODE_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${OPENCODE_AGENTS_DIR}/${name}.md`;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: OPENCODE_GLOBAL_AGENTS_MD,
  skillDir: OPENCODE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      OPENCODE_GLOBAL_RULES_DIR,
      OPENCODE_GLOBAL_COMMANDS_DIR,
      OPENCODE_GLOBAL_AGENTS_DIR,
      OPENCODE_GLOBAL_SKILLS_DIR,
      OPENCODE_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [OPENCODE_GLOBAL_AGENTS_MD, OPENCODE_GLOBAL_CONFIG_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === OPENCODE_ROOT_RULE) return OPENCODE_GLOBAL_AGENTS_MD;
    if (path === OPENCODE_CONFIG_FILE) return OPENCODE_GLOBAL_CONFIG_FILE;
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, OPENCODE_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath(slug) {
      return `${OPENCODE_GLOBAL_RULES_DIR}/${slug}.md`;
    },
    commandPath(name) {
      return `${OPENCODE_GLOBAL_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${OPENCODE_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: OPENCODE_TARGET,
  generators: target,
  capabilities,
  emptyImportMessage:
    'No OpenCode config found (AGENTS.md, .opencode/rules, .opencode/commands, .opencode/agents, .opencode/skills, or opencode.json).',
  lintRules,
  lint: {
    hooks: lintHooks,
    permissions: lintPermissions,
    ignore: lintIgnore,
  },
  project,
  globalSupport: {
    capabilities,
    detectionPaths: [
      OPENCODE_GLOBAL_AGENTS_MD,
      OPENCODE_GLOBAL_RULES_DIR,
      OPENCODE_GLOBAL_COMMANDS_DIR,
      OPENCODE_GLOBAL_AGENTS_DIR,
      OPENCODE_GLOBAL_SKILLS_DIR,
      OPENCODE_GLOBAL_CONFIG_FILE,
    ],
    layout: globalLayout,
  },
  importer: {
    rules: [
      {
        feature: 'rules',
        mode: 'singleFile',
        source: {
          project: [OPENCODE_ROOT_RULE],
          global: [OPENCODE_GLOBAL_AGENTS_MD],
        },
        canonicalDir: OPENCODE_CANONICAL_RULES_DIR,
        canonicalRootFilename: '_root.md',
        markAsRoot: true,
      },
      {
        feature: 'rules',
        mode: 'directory',
        source: {
          project: [OPENCODE_RULES_DIR],
          global: [OPENCODE_GLOBAL_RULES_DIR],
        },
        canonicalDir: OPENCODE_CANONICAL_RULES_DIR,
        extensions: ['.md'],
        map: opencodeNonRootRuleMapper,
      },
    ],
    commands: {
      feature: 'commands',
      mode: 'directory',
      source: {
        project: [OPENCODE_COMMANDS_DIR],
        global: [OPENCODE_GLOBAL_COMMANDS_DIR],
      },
      canonicalDir: OPENCODE_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      map: opencodeCommandMapper,
    },
    agents: {
      feature: 'agents',
      mode: 'directory',
      source: {
        project: [OPENCODE_AGENTS_DIR],
        global: [OPENCODE_GLOBAL_AGENTS_DIR],
      },
      canonicalDir: OPENCODE_CANONICAL_AGENTS_DIR,
      extensions: ['.md'],
      map: opencodeAgentMapper,
    },
    // MCP is imported manually in importer.ts because OpenCode uses `mcp`
    // key (not `mcpServers`) with a different server format.
  },
  buildImportPaths: buildOpencodeImportPaths,
  detectionPaths: [
    OPENCODE_RULES_DIR,
    OPENCODE_COMMANDS_DIR,
    OPENCODE_AGENTS_DIR,
    OPENCODE_SKILLS_DIR,
    OPENCODE_CONFIG_FILE,
    'opencode.jsonc',
  ],
} satisfies TargetDescriptor;
