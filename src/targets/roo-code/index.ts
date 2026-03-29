import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  generateIgnore,
} from './generator.js';
import { ROO_CODE_ROOT_RULE, ROO_CODE_RULES_DIR, ROO_CODE_COMMANDS_DIR } from './constants.js';
import { importFromRooCode } from './importer.js';
import { lintRules } from './linter.js';
import { buildRooCodeImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'roo-code',
  primaryRootInstructionPath: ROO_CODE_ROOT_RULE,
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  generateIgnore,
  importFrom: importFromRooCode,
};

export const descriptor = {
  id: 'roo-code',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'native',
    agents: 'none',
    skills: 'native',
    mcp: 'native',
    hooks: 'none',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Roo Code config found (.roo/rules, .roo/commands, .roo/skills, .roo/mcp.json, .rooignore, or .roorules).',
  lintRules,
  skillDir: '.roo/skills',
  paths: {
    rulePath(slug, _rule) {
      return `${ROO_CODE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${ROO_CODE_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
  buildImportPaths: buildRooCodeImportPaths,
  detectionPaths: [
    '.roo/rules',
    '.roo/commands',
    '.roo/skills',
    '.roo/mcp.json',
    '.rooignore',
    '.roorules',
  ],
} satisfies TargetDescriptor;
