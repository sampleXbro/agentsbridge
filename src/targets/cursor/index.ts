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
  CURSOR_COMPAT_AGENTS,
  CURSOR_AGENTS_DIR,
  CURSOR_COMMANDS_DIR,
  CURSOR_DOT_CURSOR_AGENTS,
  CURSOR_GENERAL_RULE,
  CURSOR_GLOBAL_AGENTS_DIR,
  CURSOR_GLOBAL_MCP_EXPORT,
  CURSOR_GLOBAL_SKILLS_DIR,
  CURSOR_GLOBAL_USER_RULES,
  CURSOR_HOOKS,
  CURSOR_IGNORE,
  CURSOR_MCP,
  CURSOR_RULES_DIR,
  CURSOR_SETTINGS,
  CURSOR_SKILLS_DIR,
} from './constants.js';
import { importFromCursor } from './importer.js';
import { lintRules } from './linter.js';
import { buildCursorImportPaths } from '../../core/reference/import-map-builders.js';
import { lintCommands, lintMcp, lintPermissions } from './lint.js';

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

const project: TargetLayout = {
  rootInstructionPath: CURSOR_GENERAL_RULE,
  outputFamilies: [
    {
      id: 'root-mirrors',
      kind: 'additional',
      explicitPaths: [CURSOR_COMPAT_AGENTS, CURSOR_DOT_CURSOR_AGENTS],
    },
  ],
  skillDir: '.cursor/skills',
  managedOutputs: {
    dirs: ['.cursor/agents', '.cursor/commands', '.cursor/rules', '.cursor/skills'],
    files: ['.cursor/hooks.json', '.cursor/mcp.json', '.cursorignore', 'AGENTS.md'],
  },
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
};

const global: TargetLayout = {
  rootInstructionPath: CURSOR_GENERAL_RULE,
  outputFamilies: [
    {
      id: 'root-mirrors',
      kind: 'additional',
      explicitPaths: [CURSOR_COMPAT_AGENTS, CURSOR_DOT_CURSOR_AGENTS],
    },
  ],
  skillDir: CURSOR_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      CURSOR_RULES_DIR,
      CURSOR_COMMANDS_DIR,
      CURSOR_GLOBAL_AGENTS_DIR,
      CURSOR_GLOBAL_SKILLS_DIR,
    ],
    files: [
      CURSOR_GENERAL_RULE,
      CURSOR_DOT_CURSOR_AGENTS,
      CURSOR_GLOBAL_MCP_EXPORT,
      CURSOR_HOOKS,
      CURSOR_IGNORE,
      CURSOR_GLOBAL_USER_RULES,
    ],
  },
  rewriteGeneratedPath(path) {
    if (path === CURSOR_COMPAT_AGENTS) return null;
    if (path === CURSOR_DOT_CURSOR_AGENTS) return path;
    if (path === CURSOR_GENERAL_RULE || path.startsWith(`${CURSOR_RULES_DIR}/`)) return path;
    if (path.startsWith(`${CURSOR_COMMANDS_DIR}/`)) return path;
    if (path.startsWith(`${CURSOR_AGENTS_DIR}/`)) return path;
    if (path.startsWith(`${CURSOR_SKILLS_DIR}/`)) return path;
    if (path === CURSOR_MCP) return path;
    if (path === CURSOR_HOOKS || path === CURSOR_IGNORE) return path;
    if (path === CURSOR_SETTINGS) return null;
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    if (path.startsWith(`${CURSOR_SKILLS_DIR}/`) && !activeTargets.includes('codex-cli')) {
      return path.replace(/^\.cursor\/skills\//, '.agents/skills/');
    }
    return null;
  },
  paths: {
    rulePath(slug, _rule) {
      return `${CURSOR_RULES_DIR}/${slug}.mdc`;
    },
    commandPath(name, _config) {
      return `${CURSOR_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name, _config) {
      return `${CURSOR_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'native',
  permissions: 'none',
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
  emptyImportMessage:
    'No Cursor config found (AGENTS.md or .cursor/rules/*.mdc; with --global: ~/.cursor/{rules/*.mdc,AGENTS.md,mcp.json,hooks.json,cursorignore,skills/,agents/,commands/} and legacy ~/.agentsmesh-exports/cursor/user-rules.md).',
  lintRules,
  lint: {
    commands: lintCommands,
    mcp: lintMcp,
    permissions: lintPermissions,
  },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      CURSOR_GENERAL_RULE,
      CURSOR_DOT_CURSOR_AGENTS,
      CURSOR_MCP,
      CURSOR_HOOKS,
      CURSOR_IGNORE,
      CURSOR_SKILLS_DIR,
      CURSOR_GLOBAL_AGENTS_DIR,
      CURSOR_COMMANDS_DIR,
      CURSOR_GLOBAL_USER_RULES,
    ],
    layout: global,
  },
  skillDir: project.skillDir,
  paths: project.paths,
  buildImportPaths: buildCursorImportPaths,
  detectionPaths: ['.cursor/rules', '.cursor/mcp.json'],
} satisfies TargetDescriptor;
