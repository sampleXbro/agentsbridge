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
import { CLAUDE_ROOT } from './constants.js';
import { importFromClaudeCode } from './importer.js';
import { lintRules } from './linter.js';
import { buildClaudeCodeImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'claude-code',
  primaryRootInstructionPath: CLAUDE_ROOT,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generatePermissions,
  generateHooks,
  generateIgnore,
  importFrom: importFromClaudeCode,
};

export const descriptor = {
  id: 'claude-code',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'native',
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'native',
    ignore: 'native',
    permissions: 'native',
  },
  emptyImportMessage: 'No Claude Code config found (CLAUDE.md or .claude/rules/*.md).',
  lintRules,
  skillDir: '.claude/skills',
  paths: {
    rulePath(slug, _rule) {
      return `.claude/rules/${slug}.md`;
    },
    commandPath(name, _config) {
      return `.claude/commands/${name}.md`;
    },
    agentPath(name, _config) {
      return `.claude/agents/${name}.md`;
    },
  },
  buildImportPaths: buildClaudeCodeImportPaths,
  detectionPaths: ['CLAUDE.md', '.claude/rules', '.claude/commands'],
} satisfies TargetDescriptor;
