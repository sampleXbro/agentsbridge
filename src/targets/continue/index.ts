import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import { generateRules, generateCommands, generateSkills, generateMcp } from './generator.js';
import { CONTINUE_ROOT_RULE, CONTINUE_RULES_DIR } from './constants.js';
import { importFromContinue } from './importer.js';
import { lintRules } from './linter.js';
import { continueCommandRulePath } from './command-rule.js';
import { buildContinueImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'continue',
  primaryRootInstructionPath: CONTINUE_ROOT_RULE,
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  importFrom: importFromContinue,
};

export const descriptor = {
  id: 'continue',
  generators: target,
  capabilities: {
    rules: 'native',
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
  skillDir: '.continue/skills',
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
  buildImportPaths: buildContinueImportPaths,
  detectionPaths: ['.continue/rules', '.continue/skills', '.continue/mcpServers'],
} satisfies TargetDescriptor;
