import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateHooks,
  generatePermissions,
} from './generator.js';
import { cap } from '../catalog/capabilities.js';
import {
  CLINE_AGENTS_MD,
  CLINE_RULES_DIR,
  CLINE_WORKFLOWS_DIR,
  CLINE_HOOKS_DIR,
  CLINE_SKILLS_DIR,
  CLINE_GLOBAL_SKILLS_DIR,
  CLINE_AGENTS_FILE,
  CLINE_MCP_SETTINGS,
  CLINE_IGNORE,
  CLINE_GLOBAL_RULES_DIR,
  CLINE_GLOBAL_WORKFLOWS_DIR,
} from './constants.js';
import { importFromCline } from './importer.js';
import { mergeClineOutput } from './merge.js';
import { lintRules } from './linter.js';
import { lintCommands, lintHooks, lintPermissions } from './lint.js';
import { buildClineImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'cline',
  primaryRootInstructionPath: CLINE_AGENTS_MD,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  generatePermissions,
  importFrom: importFromCline,
};

const project: TargetLayout = {
  rootInstructionPath: CLINE_AGENTS_MD,
  skillDir: CLINE_SKILLS_DIR,
  managedOutputs: {
    dirs: [CLINE_SKILLS_DIR, CLINE_RULES_DIR, CLINE_HOOKS_DIR, CLINE_WORKFLOWS_DIR],
    files: ['AGENTS.md', CLINE_IGNORE, `${CLINE_RULES_DIR}/typescript.md`],
    // Cline's own MCP settings file (its MCP panel writes `disabled`,
    // `autoApprove` and `timeout` back into it) and the combined agents
    // manifest, whose ownership is unresolved in-repo — both merged key-scoped
    // and never deleted (see merge.ts).
    coOwnedFiles: [CLINE_MCP_SETTINGS, CLINE_AGENTS_FILE],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${CLINE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${CLINE_WORKFLOWS_DIR}/${name}.md`;
    },
    // agents.yaml is a combined file — all agents go to the same output file
    agentPath(_name) {
      return CLINE_AGENTS_FILE;
    },
  },
};

const globalLayout: TargetLayout = {
  skillDir: CLINE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      CLINE_GLOBAL_RULES_DIR,
      CLINE_GLOBAL_WORKFLOWS_DIR,
      CLINE_HOOKS_DIR,
      CLINE_GLOBAL_SKILLS_DIR,
      '.agents/skills',
    ],
    files: [],
  },
  rewriteGeneratedPath(path) {
    if (path === CLINE_AGENTS_MD) return null;
    if (path.startsWith(`${CLINE_WORKFLOWS_DIR}/`)) {
      return `${CLINE_GLOBAL_WORKFLOWS_DIR}/${path.slice(CLINE_WORKFLOWS_DIR.length + 1)}`;
    }
    if (path.startsWith(`${CLINE_RULES_DIR}/`)) {
      return `${CLINE_GLOBAL_RULES_DIR}/${path.slice(CLINE_RULES_DIR.length + 1)}`;
    }
    if (path.startsWith(`${CLINE_SKILLS_DIR}/`)) {
      return `${CLINE_GLOBAL_SKILLS_DIR}/${path.slice(CLINE_SKILLS_DIR.length + 1)}`;
    }
    // `.cline/hooks` resolves to the same relative path in both scopes
    // (CLI docs: `~/.cline/hooks`) — no rewrite needed. MCP/ignore/agents are
    // scope-gated to `[]` in global scope, so they never reach this point.
    return path;
  },
  mirrorGlobalPath(path, _activeTargets) {
    if (path.startsWith(`${CLINE_GLOBAL_SKILLS_DIR}/`)) {
      return `.agents/skills/${path.slice(CLINE_GLOBAL_SKILLS_DIR.length + 1)}`;
    }
    return null;
  },
  paths: {
    rulePath(slug, _rule) {
      return `${CLINE_GLOBAL_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${CLINE_GLOBAL_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(_name) {
      return null;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'none',
  additionalRules: 'native',
  commands: cap('native', 'workflows'),
  agents: 'none',
  skills: 'native',
  mcp: 'none',
  hooks: 'native',
  ignore: 'none',
  permissions: 'partial',
};

export const descriptor = {
  id: 'cline',
  metadata: {
    displayName: 'Cline',
    category: 'ide',
    officialUrl: 'https://cline.bot',
    shortDescription: 'Autonomous coding agent for VS Code',
  },
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'native',
    commands: cap('native', 'workflows'),
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'native',
    ignore: 'native',
    permissions: 'partial',
  },
  emptyImportMessage:
    'No Cline config found (.cline/rules, .clineignore, .cline/mcp.json, .cline/agents.yaml, or .cline/skills).',
  supportsConversion: { agents: true },
  lintRules,
  lint: {
    commands: lintCommands,
    hooks: lintHooks,
    permissions: lintPermissions,
  },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      CLINE_GLOBAL_RULES_DIR,
      CLINE_GLOBAL_WORKFLOWS_DIR,
      CLINE_HOOKS_DIR,
      CLINE_GLOBAL_SKILLS_DIR,
    ],
    layout: globalLayout,
  },
  buildImportPaths: buildClineImportPaths,
  detectionPaths: ['.clinerules', '.cline'],
  nativeInstall: {
    pickPaths: [
      { prefix: CLINE_SKILLS_DIR, feature: 'skills', strategy: { kind: 'skillDir' } },
      {
        prefix: CLINE_WORKFLOWS_DIR,
        feature: 'commands',
        strategy: { kind: 'basename', suffix: '.md' },
      },
    ],
  },
  // Project agentPath returns the combined `.cline/agents.yaml` for all agent
  // names — multiple canonical agents share one output file. Global scope has
  // no agents surface (agentPath returns null there). `agentsToSkills: false`
  // is kept so the shared "none → embedded via skill projection" upgrade never
  // fires for global scope, which has no agents surface at all.
  conversionDefaults: { agentsToSkills: false },
  mergeGeneratedOutputContent: mergeClineOutput,
} satisfies TargetDescriptor;
