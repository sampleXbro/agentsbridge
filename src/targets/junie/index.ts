import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
} from './generator.js';
import {
  JUNIE_DOT_AGENTS,
  JUNIE_RULES_DIR,
  JUNIE_COMMANDS_DIR,
  JUNIE_AGENTS_DIR,
} from './constants.js';
import { importFromJunie } from './importer.js';
import { lintRules } from './linter.js';
import { buildJunieImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'junie',
  primaryRootInstructionPath: JUNIE_DOT_AGENTS,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  importFrom: importFromJunie,
};

export const descriptor = {
  id: 'junie',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'embedded',
    agents: 'embedded',
    skills: 'embedded',
    mcp: 'native',
    hooks: 'none',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Junie config found (.junie/guidelines.md, .junie/AGENTS.md, .junie/skills, .junie/mcp/mcp.json, or .aiignore).',
  lintRules,
  skillDir: '.junie/skills',
  paths: {
    rulePath(slug, _rule) {
      return `${JUNIE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${JUNIE_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name, _config) {
      return `${JUNIE_AGENTS_DIR}/${name}.md`;
    },
  },
  buildImportPaths: buildJunieImportPaths,
  detectionPaths: [
    '.junie/guidelines.md',
    '.junie/AGENTS.md',
    '.junie/skills',
    '.junie/mcp/mcp.json',
    '.aiignore',
  ],
} satisfies TargetDescriptor;
