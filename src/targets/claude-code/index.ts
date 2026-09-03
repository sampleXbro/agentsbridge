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
  CLAUDE_AGENTS_DIR,
  CLAUDE_CANONICAL_AGENTS_DIR,
  CLAUDE_CANONICAL_COMMANDS_DIR,
  CLAUDE_CANONICAL_IGNORE,
  CLAUDE_CANONICAL_MCP,
  CLAUDE_CANONICAL_RULES_DIR,
  CLAUDE_COMMANDS_DIR,
  CLAUDE_GLOBAL_MCP_JSON,
  CLAUDE_HOOKS_JSON,
  CLAUDE_IGNORE,
  CLAUDE_MCP_JSON,
  CLAUDE_NESTED_ROOT,
  CLAUDE_ROOT,
  CLAUDE_RULES_DIR,
} from './constants.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import { renderClaudeGlobalPrimaryInstructions } from './global-instructions.js';
import { generateClaudeGlobalExtras } from './global-extras.js';
import { importFromClaudeCode } from './importer.js';
import { claudeAgentMapper, claudeCommandMapper, claudeRuleMapper } from './import-mappers.js';
import { lintRules } from './linter.js';
import { buildClaudeCodeImportPaths } from '../../core/reference/import-map-builders.js';
import { mergeClaudeMcpJson } from './mcp-merge.js';

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
    // CLAUDE_NESTED_ROOT is the pre-migration project location; listing it here lets
    // `cleanupStaleGeneratedOutputs` evict a leftover `.claude/CLAUDE.md` once generation
    // writes the root `CLAUDE.md`, so Claude Code never concatenates both into context.
    files: [CLAUDE_ROOT, CLAUDE_NESTED_ROOT, '.claude/settings.json', '.claudeignore', '.mcp.json'],
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

const globalLayout: TargetLayout = {
  rootInstructionPath: CLAUDE_NESTED_ROOT,
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
      CLAUDE_NESTED_ROOT,
      '.claude/settings.json',
      CLAUDE_GLOBAL_MCP_JSON,
      CLAUDE_HOOKS_JSON,
      '.claudeignore',
    ],
  },
  rewriteGeneratedPath(path) {
    // Generator emits the root file at CLAUDE_ROOT (`CLAUDE.md`); global scope keeps it nested.
    if (path === CLAUDE_ROOT) return CLAUDE_NESTED_ROOT;
    if (path === CLAUDE_MCP_JSON) return CLAUDE_GLOBAL_MCP_JSON;
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, '.claude/skills', activeTargets);
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
  metadata: {
    displayName: 'Claude Code',
    category: 'cli',
    officialUrl: 'https://www.anthropic.com/claude-code',
    shortDescription: "Anthropic's terminal coding agent",
  },
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
  mergeGeneratedOutputContent: mergeClaudeMcpJson,
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
    layout: globalLayout,
    scopeExtras: generateClaudeGlobalExtras,
  },
  importer: {
    rules: [
      {
        // Root rule: project prefers root CLAUDE.md, falls back to nested .claude/CLAUDE.md;
        // global reads the nested .claude/CLAUDE.md.
        feature: 'rules',
        mode: 'singleFile',
        source: { project: [CLAUDE_ROOT, CLAUDE_NESTED_ROOT], global: [CLAUDE_NESTED_ROOT] },
        canonicalDir: CLAUDE_CANONICAL_RULES_DIR,
        canonicalRootFilename: '_root.md',
        markAsRoot: true,
      },
      {
        feature: 'rules',
        mode: 'directory',
        source: { project: [CLAUDE_RULES_DIR], global: [CLAUDE_RULES_DIR] },
        canonicalDir: CLAUDE_CANONICAL_RULES_DIR,
        extensions: ['.md'],
        map: claudeRuleMapper,
      },
    ],
    commands: {
      feature: 'commands',
      mode: 'directory',
      source: { project: [CLAUDE_COMMANDS_DIR], global: [CLAUDE_COMMANDS_DIR] },
      canonicalDir: CLAUDE_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      map: claudeCommandMapper,
    },
    agents: {
      feature: 'agents',
      mode: 'directory',
      source: { project: [CLAUDE_AGENTS_DIR], global: [CLAUDE_AGENTS_DIR] },
      canonicalDir: CLAUDE_CANONICAL_AGENTS_DIR,
      extensions: ['.md'],
      map: claudeAgentMapper,
    },
    mcp: {
      feature: 'mcp',
      mode: 'mcpJson',
      source: { project: [CLAUDE_MCP_JSON], global: [CLAUDE_GLOBAL_MCP_JSON] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: CLAUDE_CANONICAL_MCP,
    },
    ignore: {
      feature: 'ignore',
      mode: 'flatFile',
      source: { project: [CLAUDE_IGNORE], global: [CLAUDE_IGNORE] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: CLAUDE_CANONICAL_IGNORE,
    },
  },
  buildImportPaths: buildClaudeCodeImportPaths,
  detectionPaths: [CLAUDE_ROOT, CLAUDE_NESTED_ROOT, '.claude/rules', '.claude/commands'],
  nativeInstall: {
    pickPaths: [
      {
        prefix: '.claude/commands',
        feature: 'commands',
        strategy: { kind: 'basename', suffix: '.md' },
      },
      { prefix: '.claude/rules', feature: 'rules', strategy: { kind: 'basename', suffix: '.md' } },
      {
        prefix: '.claude/agents',
        feature: 'agents',
        strategy: { kind: 'basename', suffix: '.md' },
      },
      { prefix: '.claude/skills/', feature: 'skills', strategy: { kind: 'firstSegment' } },
    ],
  },
} satisfies TargetDescriptor;
