import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { generateRules, generateCommands, generateSkills, generateMcp } from './generator.js';
import {
  CONTINUE_ROOT_RULE,
  CONTINUE_RULES_DIR,
  CONTINUE_PROMPTS_DIR,
  CONTINUE_MCP_FILE,
  CONTINUE_SKILLS_DIR,
  CONTINUE_GLOBAL_AGENTS_MD,
  CONTINUE_GLOBAL_CONFIG,
  CONTINUE_CANONICAL_RULES_DIR,
  CONTINUE_CANONICAL_COMMANDS_DIR,
} from './constants.js';
import { importFromContinue } from './importer.js';
import { continueCommandMapper, continueRuleMapper } from './import-mappers.js';
import { lintRules } from './linter.js';
import { lintCommands } from './lint.js';
import { continueCommandRulePath } from './command-rule.js';
import { buildContinueImportPaths } from '../../core/reference/import-map-builders.js';
import { generateContinueScopeExtras } from './scope-extras.js';

export const target: TargetGenerators = {
  name: 'continue',
  primaryRootInstructionPath: CONTINUE_ROOT_RULE,
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  importFrom: importFromContinue,
};

const project: TargetLayout = {
  rootInstructionPath: CONTINUE_ROOT_RULE,
  skillDir: '.continue/skills',
  managedOutputs: {
    dirs: ['.continue/prompts', '.continue/rules', '.continue/skills'],
    files: ['.continue/mcpServers/agentsmesh.json'],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${CONTINUE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return continueCommandRulePath(name);
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: CONTINUE_ROOT_RULE,
  outputFamilies: [
    { id: 'compat-agents', kind: 'additional', explicitPaths: [CONTINUE_GLOBAL_AGENTS_MD] },
  ],
  skillDir: CONTINUE_SKILLS_DIR,
  managedOutputs: {
    dirs: [CONTINUE_RULES_DIR, CONTINUE_PROMPTS_DIR, CONTINUE_SKILLS_DIR, '.agents/skills'],
    files: [CONTINUE_MCP_FILE, CONTINUE_GLOBAL_AGENTS_MD, CONTINUE_GLOBAL_CONFIG],
  },
  mirrorGlobalPath(path, _activeTargets) {
    if (path.startsWith(`${CONTINUE_SKILLS_DIR}/`)) {
      return `.agents/skills/${path.slice(CONTINUE_SKILLS_DIR.length + 1)}`;
    }
    return null;
  },
  paths: {
    rulePath(slug, _rule) {
      return `${CONTINUE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${CONTINUE_PROMPTS_DIR}/${name}.md`;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: 'continue',
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'native',
    commands: 'embedded',
    agents: 'none',
    skills: 'embedded',
    mcp: 'native',
    hooks: 'none',
    ignore: 'none',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Continue config found (.continue/rules/*.md, .continue/skills, or .continue/mcpServers/*).',
  lintRules,
  lint: {
    commands: lintCommands,
  },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      CONTINUE_RULES_DIR,
      CONTINUE_PROMPTS_DIR,
      '.continue/mcpServers',
      CONTINUE_SKILLS_DIR,
    ],
    layout: globalLayout,
    scopeExtras: generateContinueScopeExtras,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'directory',
      source: { project: [CONTINUE_RULES_DIR], global: [CONTINUE_RULES_DIR] },
      canonicalDir: CONTINUE_CANONICAL_RULES_DIR,
      extensions: ['.md'],
      map: continueRuleMapper,
    },
    commands: {
      feature: 'commands',
      mode: 'directory',
      source: { project: [CONTINUE_PROMPTS_DIR], global: [CONTINUE_PROMPTS_DIR] },
      canonicalDir: CONTINUE_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      map: continueCommandMapper,
    },
  },
  buildImportPaths: buildContinueImportPaths,
  detectionPaths: ['.continue/rules', '.continue/skills', '.continue/mcpServers'],
} satisfies TargetDescriptor;
