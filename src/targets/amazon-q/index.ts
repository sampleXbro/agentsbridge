/**
 * Amazon Q Developer target descriptor.
 *
 * Amazon Q Developer uses `.amazonq/rules/*.md` for project-level rules and
 * `.amazonq/mcp.json` for MCP configuration. There is no separate root
 * instruction file — all rules (including the root) go into the rules directory.
 *
 * Global scope lives under `~/.aws/amazonq/` (represented here as `.aws/amazonq/`
 * relative to the user home directory).
 *
 * Features:
 *   - rules: native (directory of .md files)
 *   - mcp: native (.amazonq/mcp.json / ~/.aws/amazonq/mcp.json)
 *   - commands/agents/skills/hooks/ignore/permissions: none
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { generateRules, generateMcp } from './generator.js';
import { importFromAmazonQ } from './importer.js';
import { lintRules } from './linter.js';
import { buildAmazonQImportPaths } from '../../core/reference/import-map-builders.js';
import {
  AMAZON_Q_TARGET,
  AMAZON_Q_RULES_DIR,
  AMAZON_Q_MCP_FILE,
  AMAZON_Q_GLOBAL_RULES_DIR,
  AMAZON_Q_GLOBAL_MCP_FILE,
  AMAZON_Q_CANONICAL_RULES_DIR,
  AMAZON_Q_CANONICAL_MCP,
} from './constants.js';

export const target: TargetGenerators = {
  name: AMAZON_Q_TARGET,
  generateRules,
  generateMcp,
  importFrom: importFromAmazonQ,
};

const project: TargetLayout = {
  managedOutputs: {
    dirs: [AMAZON_Q_RULES_DIR],
    files: [AMAZON_Q_MCP_FILE],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${AMAZON_Q_RULES_DIR}/${slug}.md`;
    },
    commandPath(_name, _config) {
      return null;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

const global: TargetLayout = {
  managedOutputs: {
    dirs: [AMAZON_Q_GLOBAL_RULES_DIR],
    files: [AMAZON_Q_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path: string) {
    if (path.startsWith(`${AMAZON_Q_RULES_DIR}/`)) {
      return path.replace(`${AMAZON_Q_RULES_DIR}/`, `${AMAZON_Q_GLOBAL_RULES_DIR}/`);
    }
    if (path === AMAZON_Q_MCP_FILE) {
      return AMAZON_Q_GLOBAL_MCP_FILE;
    }
    return path;
  },
  paths: {
    rulePath(slug, _rule) {
      return `${AMAZON_Q_GLOBAL_RULES_DIR}/${slug}.md`;
    },
    commandPath(_name, _config) {
      return null;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'none',
  commands: 'none',
  agents: 'none',
  skills: 'none',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: AMAZON_Q_TARGET,
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'none',
    commands: 'none',
    agents: 'none',
    skills: 'none',
    mcp: 'native',
    hooks: 'none',
    ignore: 'none',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Amazon Q Developer config found (.amazonq/rules/ or .amazonq/mcp.json).',
  lintRules,
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [AMAZON_Q_GLOBAL_RULES_DIR, AMAZON_Q_GLOBAL_MCP_FILE],
    layout: global,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'directory',
      source: {
        project: [AMAZON_Q_RULES_DIR],
        global: [AMAZON_Q_GLOBAL_RULES_DIR],
      },
      canonicalDir: AMAZON_Q_CANONICAL_RULES_DIR,
      extensions: ['.md'],
      preset: 'rule',
    },
    mcp: {
      feature: 'mcp',
      mode: 'mcpJson',
      source: {
        project: [AMAZON_Q_MCP_FILE],
        global: [AMAZON_Q_GLOBAL_MCP_FILE],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: AMAZON_Q_CANONICAL_MCP,
    },
  },
  buildImportPaths: buildAmazonQImportPaths,
  detectionPaths: [AMAZON_Q_RULES_DIR, AMAZON_Q_MCP_FILE],
} satisfies TargetDescriptor;
