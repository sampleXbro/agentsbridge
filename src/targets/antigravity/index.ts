import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { cap } from '../catalog/capabilities.js';
import {
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  renderAntigravityGlobalInstructions,
} from './generator.js';
import {
  ANTIGRAVITY_GLOBAL_MCP_CONFIG,
  ANTIGRAVITY_GLOBAL_ROOT,
  ANTIGRAVITY_GLOBAL_SKILLS_DIR,
  ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR,
  ANTIGRAVITY_MCP_CONFIG,
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
  ANTIGRAVITY_CANONICAL_COMMANDS_DIR,
  ANTIGRAVITY_CANONICAL_MCP,
  ANTIGRAVITY_CANONICAL_RULES_DIR,
} from './constants.js';
import { importFromAntigravity } from './importer.js';
import { nonRootRuleMapper, workflowMapper } from './import-mappers.js';
import { lintRules } from './linter.js';
import { buildAntigravityImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'antigravity',
  primaryRootInstructionPath: ANTIGRAVITY_RULES_ROOT,
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  importFrom: importFromAntigravity,
};

const project: TargetLayout = {
  rootInstructionPath: ANTIGRAVITY_RULES_ROOT,
  skillDir: '.agents/skills',
  rewriteGeneratedPath(path) {
    if (path === ANTIGRAVITY_MCP_CONFIG) return null;
    return path;
  },
  paths: {
    rulePath(slug, _rule) {
      return `${ANTIGRAVITY_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${ANTIGRAVITY_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

const global: TargetLayout = {
  rootInstructionPath: ANTIGRAVITY_GLOBAL_ROOT,
  renderPrimaryRootInstruction: renderAntigravityGlobalInstructions,
  skillDir: ANTIGRAVITY_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [ANTIGRAVITY_GLOBAL_SKILLS_DIR, ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR],
    files: [ANTIGRAVITY_GLOBAL_ROOT, ANTIGRAVITY_GLOBAL_MCP_CONFIG],
  },
  rewriteGeneratedPath(path) {
    if (path === ANTIGRAVITY_RULES_ROOT) return ANTIGRAVITY_GLOBAL_ROOT;
    if (path.startsWith(`${ANTIGRAVITY_RULES_DIR}/`)) return null;
    if (path.startsWith('.agents/skills/')) {
      return path.replace('.agents/skills', ANTIGRAVITY_GLOBAL_SKILLS_DIR);
    }
    if (path.startsWith(`${ANTIGRAVITY_WORKFLOWS_DIR}/`)) {
      return path.replace(ANTIGRAVITY_WORKFLOWS_DIR, ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR);
    }
    if (path === ANTIGRAVITY_MCP_CONFIG) return ANTIGRAVITY_GLOBAL_MCP_CONFIG;
    return path;
  },
  paths: {
    rulePath(_slug, _rule) {
      return ANTIGRAVITY_GLOBAL_ROOT;
    },
    commandPath(name, _config) {
      return `${ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: cap('partial', 'workflows'),
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: 'antigravity',
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'native',
    commands: cap('partial', 'workflows'),
    agents: 'none',
    skills: 'native',
    mcp: 'none',
    hooks: 'none',
    ignore: 'none',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Antigravity config found (.agents/rules/, .agents/skills/, or .agents/workflows/).',
  lintRules,
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      '.gemini/antigravity/GEMINI.md',
      '.gemini/antigravity/skills',
      '.gemini/antigravity/workflows',
      '.gemini/antigravity/mcp_config.json',
    ],
    layout: global,
  },
  importer: {
    rules: {
      // Project-only directory scan; root rule + global-aggregated rules
      // (which collapse into the single .gemini/antigravity/GEMINI.md) are
      // handled imperatively in importer.ts.
      feature: 'rules',
      mode: 'directory',
      source: { project: [ANTIGRAVITY_RULES_DIR] },
      canonicalDir: ANTIGRAVITY_CANONICAL_RULES_DIR,
      extensions: ['.md'],
      map: nonRootRuleMapper,
    },
    commands: {
      feature: 'commands',
      mode: 'directory',
      source: {
        project: [ANTIGRAVITY_WORKFLOWS_DIR],
        global: [ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR],
      },
      canonicalDir: ANTIGRAVITY_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      map: workflowMapper,
    },
    mcp: {
      // MCP is global-only; project-scope generation is suppressed. Source file
      // is copied verbatim (the file is already canonical-shaped JSON).
      feature: 'mcp',
      mode: 'flatFile',
      source: { global: [ANTIGRAVITY_GLOBAL_MCP_CONFIG] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: ANTIGRAVITY_CANONICAL_MCP,
    },
  },
  buildImportPaths: buildAntigravityImportPaths,
  detectionPaths: [
    '.agents/rules/general.md',
    '.agents/rules/',
    '.agents/skills/',
    '.agents/workflows/',
  ],
} satisfies TargetDescriptor;
