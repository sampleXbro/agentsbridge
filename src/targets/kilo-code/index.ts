/**
 * Kilo Code target descriptor.
 *
 * Generation always uses the new layout:
 *   - `AGENTS.md`              — root rule (kilo's documented portable root)
 *   - `.kilo/rules/<slug>.md`  — additional rules
 *   - `.kilo/commands/`        — slash commands
 *   - `.kilo/agents/`          — first-class subagents (YAML frontmatter)
 *   - `.kilo/skills/`          — Anthropic-conventional skill bundles
 *   - `.kilo/mcp.json`         — MCP servers (mcpServers wrapper)
 *   - `.kilocodeignore`        — ignore patterns (legacy filename, only
 *                                natively-loaded ignore in kilo today)
 *   - `kilo.jsonc`             — permissions (permission key)
 *
 * Import covers BOTH new and legacy layouts so existing kilo / Roo-era users
 * round-trip cleanly.
 */

import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generatePermissions,
} from './generator.js';
import {
  KILO_CODE_TARGET,
  KILO_CODE_ROOT_RULE,
  KILO_CODE_LEGACY_RULES_DIR,
  KILO_CODE_LEGACY_WORKFLOWS_DIR,
  KILO_CODE_LEGACY_SKILLS_DIR,
  KILO_CODE_LEGACY_MCP_FILE,
  KILO_CODE_LEGACY_MODES_FILE,
  KILO_CODE_GLOBAL_AGENTS_MD,
  KILO_CODE_GLOBAL_RULES_DIR,
  KILO_CODE_GLOBAL_COMMANDS_DIR,
  KILO_CODE_GLOBAL_AGENTS_DIR,
  KILO_CODE_GLOBAL_SKILLS_DIR,
  KILO_CODE_GLOBAL_MCP_FILE,
  KILO_CODE_GLOBAL_IGNORE,
  KILO_CODE_RULES_DIR,
  KILO_CODE_COMMANDS_DIR,
  KILO_CODE_AGENTS_DIR,
  KILO_CODE_SKILLS_DIR,
  KILO_CODE_MCP_FILE,
  KILO_CODE_IGNORE,
  KILO_CODE_CANONICAL_RULES_DIR,
  KILO_CODE_CANONICAL_COMMANDS_DIR,
  KILO_CODE_CANONICAL_AGENTS_DIR,
  KILO_CODE_CANONICAL_MCP,
  KILO_CODE_CANONICAL_IGNORE,
} from './constants.js';
import { importFromKiloCode } from './importer.js';
import { kiloAgentMapper, kiloCommandMapper, kiloNonRootRuleMapper } from './import-mappers.js';
import { lintRules } from './linter.js';
import { lintHooks } from './lint.js';
import { buildKiloCodeImportPaths } from '../../core/reference/import-map-builders.js';
import { mergeKiloConfig } from './merge.js';
import { project, globalLayout, capabilities, globalCapabilities } from './layout.js';

export const target: TargetGenerators = {
  name: KILO_CODE_TARGET,
  primaryRootInstructionPath: KILO_CODE_ROOT_RULE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generatePermissions,
  importFrom: importFromKiloCode,
};

export const descriptor = {
  id: KILO_CODE_TARGET,
  metadata: {
    displayName: 'Kilo Code',
    category: 'ide',
    officialUrl: 'https://kilocode.ai',
    shortDescription: 'Open-source AI coding agent for VS Code',
  },
  generators: target,
  capabilities,
  emptyImportMessage:
    'No Kilo Code config found (AGENTS.md, .kilo/rules, .kilo/commands, .kilo/agents, .kilo/skills, .kilo/mcp.json, .kilocodeignore, .kilocode/, or .kilocodemodes).',
  lintRules,
  lint: {
    hooks: lintHooks,
  },
  mergeGeneratedOutputContent: mergeKiloConfig,
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      KILO_CODE_GLOBAL_AGENTS_MD,
      KILO_CODE_GLOBAL_RULES_DIR,
      KILO_CODE_GLOBAL_COMMANDS_DIR,
      KILO_CODE_GLOBAL_AGENTS_DIR,
      KILO_CODE_GLOBAL_SKILLS_DIR,
      KILO_CODE_GLOBAL_MCP_FILE,
      KILO_CODE_GLOBAL_IGNORE,
    ],
    layout: globalLayout,
  },
  importer: {
    rules: [
      {
        // Root rule: prefer AGENTS.md (new) → in legacy projects users
        // historically used .kilocode/rules/00-root.md, but those import
        // through the descriptor's directory mapper as a regular rule with
        // slug `00-root` (we don't promote them to root). The legacy global
        // rules dir falls back to AGENTS.md only.
        feature: 'rules',
        mode: 'singleFile',
        source: {
          project: [KILO_CODE_ROOT_RULE],
          global: [KILO_CODE_GLOBAL_AGENTS_MD],
        },
        canonicalDir: KILO_CODE_CANONICAL_RULES_DIR,
        canonicalRootFilename: '_root.md',
        markAsRoot: true,
      },
      {
        feature: 'rules',
        mode: 'directory',
        source: {
          project: [KILO_CODE_RULES_DIR],
          global: [KILO_CODE_GLOBAL_RULES_DIR],
        },
        canonicalDir: KILO_CODE_CANONICAL_RULES_DIR,
        extensions: ['.md'],
        map: kiloNonRootRuleMapper,
      },
    ],
    commands: {
      feature: 'commands',
      mode: 'directory',
      source: {
        project: [KILO_CODE_COMMANDS_DIR],
        global: [KILO_CODE_GLOBAL_COMMANDS_DIR],
      },
      canonicalDir: KILO_CODE_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      map: kiloCommandMapper,
    },
    agents: {
      feature: 'agents',
      mode: 'directory',
      source: {
        project: [KILO_CODE_AGENTS_DIR],
        global: [KILO_CODE_GLOBAL_AGENTS_DIR],
      },
      canonicalDir: KILO_CODE_CANONICAL_AGENTS_DIR,
      extensions: ['.md'],
      map: kiloAgentMapper,
    },
    mcp: {
      feature: 'mcp',
      mode: 'mcpJson',
      source: {
        project: [KILO_CODE_MCP_FILE, KILO_CODE_LEGACY_MCP_FILE],
        global: [KILO_CODE_GLOBAL_MCP_FILE],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: KILO_CODE_CANONICAL_MCP,
    },
    ignore: {
      feature: 'ignore',
      mode: 'flatFile',
      source: {
        project: [KILO_CODE_IGNORE],
        global: [KILO_CODE_GLOBAL_IGNORE],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: KILO_CODE_CANONICAL_IGNORE,
    },
  },
  buildImportPaths: buildKiloCodeImportPaths,
  detectionPaths: [
    KILO_CODE_RULES_DIR,
    KILO_CODE_COMMANDS_DIR,
    KILO_CODE_AGENTS_DIR,
    KILO_CODE_SKILLS_DIR,
    KILO_CODE_MCP_FILE,
    KILO_CODE_LEGACY_RULES_DIR,
    KILO_CODE_LEGACY_WORKFLOWS_DIR,
    KILO_CODE_LEGACY_SKILLS_DIR,
    KILO_CODE_LEGACY_MCP_FILE,
    KILO_CODE_LEGACY_MODES_FILE,
    KILO_CODE_IGNORE,
    'kilo.jsonc',
    'kilo.json',
  ],
} satisfies TargetDescriptor;
