import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import { generateRules, generateWorkflows, generateSkills } from './generator.js';
import {
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
} from './constants.js';
import { importFromAntigravity } from './importer.js';
import { lintRules } from './linter.js';
import { buildAntigravityImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'antigravity',
  primaryRootInstructionPath: ANTIGRAVITY_RULES_ROOT,
  generateRules,
  generateCommands: generateWorkflows,
  generateSkills,
  importFrom: importFromAntigravity,
};

export const descriptor = {
  id: 'antigravity',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'partial',
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
  skillDir: '.agents/skills',
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
  buildImportPaths: buildAntigravityImportPaths,
  detectionPaths: [
    '.agents/rules/general.md',
    '.agents/rules/',
    '.agents/skills/',
    '.agents/workflows/',
  ],
} satisfies TargetDescriptor;
