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
 *   - agents: native (.amazonq/cli-agents/{name}.json)
 *   - hooks: partial (per-agent only; canonical hooks not projected as standalone)
 *   - permissions: partial (per-agent allowedTools; canonical permissions not projected)
 *   - commands/skills/ignore: none
 */

import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { generateRules, generateMcp, generateAgents } from './generator.js';
import { importFromAmazonQ } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions } from './lint.js';
import { buildAmazonQImportPaths } from '../../core/reference/import-map-builders.js';
import { amazonQImporterSpec } from './importer-spec.js';
import { projectCapabilities, globalCapabilities } from './capabilities.js';
import {
  AMAZON_Q_TARGET,
  AMAZON_Q_RULES_DIR,
  AMAZON_Q_MCP_FILE,
  AMAZON_Q_AGENTS_DIR,
  AMAZON_Q_GLOBAL_RULES_DIR,
  AMAZON_Q_GLOBAL_MCP_FILE,
  AMAZON_Q_GLOBAL_AGENTS_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: AMAZON_Q_TARGET,
  generateRules,
  generateMcp,
  generateAgents,
  importFrom: importFromAmazonQ,
};

const project: TargetLayout = {
  managedOutputs: {
    dirs: [AMAZON_Q_RULES_DIR, AMAZON_Q_AGENTS_DIR],
    files: [AMAZON_Q_MCP_FILE],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${AMAZON_Q_RULES_DIR}/${slug}.md`;
    },
    commandPath(_name, _config) {
      return null;
    },
    agentPath(name, _config) {
      return `${AMAZON_Q_AGENTS_DIR}/${name}.json`;
    },
  },
};

const globalLayout: TargetLayout = {
  managedOutputs: {
    dirs: [AMAZON_Q_GLOBAL_RULES_DIR, AMAZON_Q_GLOBAL_AGENTS_DIR],
    files: [AMAZON_Q_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path: string) {
    if (path.startsWith(`${AMAZON_Q_AGENTS_DIR}/`)) {
      return path.replace(`${AMAZON_Q_AGENTS_DIR}/`, `${AMAZON_Q_GLOBAL_AGENTS_DIR}/`);
    }
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
    agentPath(name, _config) {
      return `${AMAZON_Q_GLOBAL_AGENTS_DIR}/${name}.json`;
    },
  },
};

export const descriptor = {
  id: AMAZON_Q_TARGET,
  metadata: {
    displayName: 'Amazon Q Developer',
    category: 'ide',
    officialUrl: 'https://aws.amazon.com/q/developer',
    shortDescription: 'AWS AI coding assistant',
  },
  generators: target,
  capabilities: projectCapabilities,
  emptyImportMessage:
    'No Amazon Q Developer config found (.amazonq/rules/, .amazonq/cli-agents/, or .amazonq/mcp.json).',
  lintRules,
  lint: {
    hooks: lintHooks,
    permissions: lintPermissions,
  },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [AMAZON_Q_GLOBAL_RULES_DIR, AMAZON_Q_GLOBAL_MCP_FILE, AMAZON_Q_GLOBAL_AGENTS_DIR],
    layout: globalLayout,
  },
  importer: amazonQImporterSpec,
  buildImportPaths: buildAmazonQImportPaths,
  detectionPaths: [AMAZON_Q_RULES_DIR, AMAZON_Q_AGENTS_DIR, AMAZON_Q_MCP_FILE],
} satisfies TargetDescriptor;
