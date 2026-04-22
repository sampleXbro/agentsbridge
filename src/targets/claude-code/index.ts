import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
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
import {
  CLAUDE_GLOBAL_MCP_JSON,
  CLAUDE_HOOKS_JSON,
  CLAUDE_MCP_JSON,
  CLAUDE_ROOT,
} from './constants.js';
import { renderClaudeGlobalPrimaryInstructions } from './global-instructions.js';
import { generateClaudeGlobalExtras } from './global-extras.js';
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

const project: TargetLayout = {
  rootInstructionPath: CLAUDE_ROOT,
  skillDir: '.claude/skills',
  managedOutputs: {
    dirs: ['.claude/agents', '.claude/commands', '.claude/rules', '.claude/skills'],
    files: ['.claude/CLAUDE.md', '.claude/settings.json', '.claudeignore', '.mcp.json'],
  },
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
};

const global: TargetLayout = {
  rootInstructionPath: CLAUDE_ROOT,
  skillDir: '.claude/skills',
  renderPrimaryRootInstruction: renderClaudeGlobalPrimaryInstructions,
  managedOutputs: {
    dirs: [
      '.claude/agents',
      '.claude/commands',
      '.claude/rules',
      '.claude/skills',
      '.claude/output-styles',
      '.agents/skills',
    ],
    files: [
      '.claude/CLAUDE.md',
      '.claude/settings.json',
      CLAUDE_GLOBAL_MCP_JSON,
      CLAUDE_HOOKS_JSON,
      '.claudeignore',
    ],
  },
  rewriteGeneratedPath(path) {
    if (path === CLAUDE_MCP_JSON) return CLAUDE_GLOBAL_MCP_JSON;
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    // Mirror ~/.claude/skills/ to ~/.agents/skills/ unless codex-cli already owns that dir
    if (path.startsWith('.claude/skills/') && !activeTargets.includes('codex-cli')) {
      return path.replace(/^\.claude\/skills\//, '.agents/skills/');
    }
    return null;
  },
  paths: project.paths,
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'native',
  permissions: 'native',
};

export const descriptor = {
  id: 'claude-code',
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'native',
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
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      '.claude/CLAUDE.md',
      '.claude/rules',
      '.claude/commands',
      '.claude/agents',
      '.claude/skills',
      '.claude/settings.json',
      '.claude/hooks.json',
      '.claude/output-styles',
      '.claudeignore',
      '.claude.json',
      '.agents/skills',
    ],
    layout: global,
    scopeExtras: generateClaudeGlobalExtras,
  },
  skillDir: project.skillDir,
  paths: project.paths,
  buildImportPaths: buildClaudeCodeImportPaths,
  detectionPaths: ['CLAUDE.md', '.claude/rules', '.claude/commands'],
} satisfies TargetDescriptor;
