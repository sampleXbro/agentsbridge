import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generatePermissions,
  generateHooks,
  generateIgnore,
} from './generator.js';
import { CURSOR_GENERAL_RULE } from './constants.js';
import { importFromCursor } from './importer.js';
import { lintRules } from './linter.js';
import { buildCursorImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'cursor',
  primaryRootInstructionPath: CURSOR_GENERAL_RULE,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generatePermissions,
  generateHooks,
  generateIgnore,
  importFrom: importFromCursor,
};

export const descriptor = {
  id: 'cursor',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'native',
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'native',
    ignore: 'native',
    permissions: 'partial',
  },
  emptyImportMessage: 'No Cursor config found (AGENTS.md or .cursor/rules/*.mdc).',
  lintRules,
  skillDir: '.cursor/skills',
  paths: {
    rulePath(slug, _rule) {
      return `.cursor/rules/${slug}.mdc`;
    },
    commandPath(name, _config) {
      return `.cursor/commands/${name}.md`;
    },
    agentPath(name, _config) {
      return `.cursor/agents/${name}.md`;
    },
  },
  buildImportPaths: buildCursorImportPaths,
  detectionPaths: ['.cursor/rules', '.cursor/mcp.json'],
} satisfies TargetDescriptor;
