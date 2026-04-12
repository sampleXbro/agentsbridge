import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
} from './generator.js';
import { importFromKiro } from './importer.js';
import { lintRules } from './linter.js';
import { buildKiroImportPaths } from '../../core/reference/import-map-builders.js';
import {
  KIRO_TARGET,
  KIRO_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_HOOKS_DIR,
  KIRO_MCP_FILE,
  KIRO_IGNORE,
} from './constants.js';

export const target: TargetGenerators = {
  name: KIRO_TARGET,
  primaryRootInstructionPath: KIRO_AGENTS_MD,
  generateRules,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromKiro,
};

export const descriptor = {
  id: KIRO_TARGET,
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'none',
    agents: 'none',
    skills: 'native',
    mcp: 'native',
    hooks: 'native',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Kiro config found (AGENTS.md, .kiro/steering, .kiro/skills, .kiro/hooks, .kiro/settings/mcp.json, or .kiroignore).',
  lintRules,
  skillDir: KIRO_SKILLS_DIR,
  paths: {
    rulePath(slug, _rule) {
      return `${KIRO_STEERING_DIR}/${slug}.md`;
    },
    commandPath(_name, _config) {
      return null;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
  buildImportPaths: buildKiroImportPaths,
  detectionPaths: [KIRO_STEERING_DIR, KIRO_SKILLS_DIR, KIRO_HOOKS_DIR, KIRO_MCP_FILE, KIRO_IGNORE],
} satisfies TargetDescriptor;
