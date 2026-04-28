import { join, basename } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import type { TargetGenerators, TargetCapabilities } from '../catalog/target.interface.js';
import type {
  TargetDescriptor,
  TargetLayout,
  ScopeExtrasFn,
} from '../catalog/target-descriptor.js';
import type { GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import {
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateAgents,
} from './generator.js';
import {
  ROO_CODE_ROOT_RULE,
  ROO_CODE_ROOT_RULE_FALLBACK,
  ROO_CODE_RULES_DIR,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_MCP_FILE,
  ROO_CODE_IGNORE,
  ROO_CODE_MODES_FILE,
  ROO_CODE_GLOBAL_RULES_DIR,
  ROO_CODE_GLOBAL_COMMANDS_DIR,
  ROO_CODE_GLOBAL_SKILLS_DIR,
  ROO_CODE_GLOBAL_MCP_FILE,
  ROO_CODE_GLOBAL_IGNORE,
  ROO_CODE_GLOBAL_AGENTS_MD,
  ROO_CODE_GLOBAL_AGENTS_SKILLS_DIR,
  ROO_CODE_GLOBAL_MODES_FILE,
  ROO_CODE_CANONICAL_RULES_DIR,
  ROO_CODE_CANONICAL_COMMANDS_DIR,
  ROO_CODE_CANONICAL_MCP,
  ROO_CODE_CANONICAL_IGNORE,
} from './constants.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import { importFromRooCode } from './importer.js';
import { rooCommandMapper, rooNonRootRuleMapper } from './import-mappers.js';
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
  generateAgents,
  importFrom: importFromRooCode,
};

const project: TargetLayout = {
  rootInstructionPath: ROO_CODE_ROOT_RULE,
  skillDir: '.roo/skills',
  managedOutputs: {
    dirs: ['.roo/rules', '.roo/commands', '.roo/skills'],
    files: ['.roo/mcp.json', '.rooignore', '.roorules', ROO_CODE_MODES_FILE],
  },
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
};

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

const generateRooGlobalExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global') return [];
  if (!enabledFeatures.has('agents') || canonical.agents.length === 0) return [];

  const customModes = canonical.agents.map((agent) => {
    const slug = basename(agent.source, '.md');
    const mode: Record<string, unknown> = { slug, name: agent.name };
    if (agent.description) mode.description = agent.description;
    if (agent.body.trim()) mode.roleDefinition = agent.body.trim();
    return mode;
  });

  const content = yamlStringify({ customModes });
  const existing = await readFileSafe(join(projectRoot, ROO_CODE_GLOBAL_MODES_FILE));
  return [
    {
      target: 'roo-code',
      path: ROO_CODE_GLOBAL_MODES_FILE,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    },
  ];
};

const global: TargetLayout = {
  rootInstructionPath: ROO_CODE_GLOBAL_AGENTS_MD,
  skillDir: ROO_CODE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      ROO_CODE_GLOBAL_RULES_DIR,
      ROO_CODE_GLOBAL_COMMANDS_DIR,
      ROO_CODE_GLOBAL_SKILLS_DIR,
      ROO_CODE_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [
      ROO_CODE_GLOBAL_AGENTS_MD,
      ROO_CODE_GLOBAL_MCP_FILE,
      ROO_CODE_GLOBAL_IGNORE,
      ROO_CODE_GLOBAL_MODES_FILE,
    ],
  },
  rewriteGeneratedPath(path) {
    // Transform project-level paths to global ~/.roo/ paths
    if (path === ROO_CODE_ROOT_RULE) {
      return ROO_CODE_GLOBAL_AGENTS_MD;
    }
    if (path === ROO_CODE_MODES_FILE) {
      // Suppress .roomodes in global mode; scopeExtras emits settings/custom_modes.yaml instead
      return null;
    }
    if (path.startsWith(`${ROO_CODE_RULES_DIR}/`)) {
      return path.replace(`${ROO_CODE_RULES_DIR}/`, `${ROO_CODE_GLOBAL_RULES_DIR}/`);
    }
    if (path.startsWith(`${ROO_CODE_COMMANDS_DIR}/`)) {
      return path.replace(`${ROO_CODE_COMMANDS_DIR}/`, `${ROO_CODE_GLOBAL_COMMANDS_DIR}/`);
    }
    if (path.startsWith(`${ROO_CODE_SKILLS_DIR}/`)) {
      return path.replace(`${ROO_CODE_SKILLS_DIR}/`, `${ROO_CODE_GLOBAL_SKILLS_DIR}/`);
    }
    if (path === ROO_CODE_MCP_FILE) {
      return ROO_CODE_GLOBAL_MCP_FILE;
    }
    if (path === ROO_CODE_IGNORE) {
      return ROO_CODE_GLOBAL_IGNORE;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, ROO_CODE_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath(slug, _rule) {
      return `${ROO_CODE_GLOBAL_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${ROO_CODE_GLOBAL_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'partial',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'native',
  permissions: 'none',
};

export const descriptor = {
  id: 'roo-code',
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'native',
    commands: 'native',
    agents: 'partial',
    skills: 'native',
    mcp: 'native',
    hooks: 'none',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Roo Code config found (.roo/rules, .roo/commands, .roo/skills, .roo/mcp.json, .rooignore, or .roorules).',
  lintRules,
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      ROO_CODE_GLOBAL_RULES_DIR,
      ROO_CODE_GLOBAL_COMMANDS_DIR,
      ROO_CODE_GLOBAL_SKILLS_DIR,
      ROO_CODE_GLOBAL_MCP_FILE,
      ROO_CODE_GLOBAL_IGNORE,
      ROO_CODE_GLOBAL_AGENTS_MD,
      ROO_CODE_GLOBAL_MODES_FILE,
    ],
    layout: global,
    scopeExtras: generateRooGlobalExtras,
  },
  importer: {
    rules: [
      {
        // Root rule: prefer global AGENTS.md, then `.roo/rules/00-root.md`, then flat `.roorules`.
        feature: 'rules',
        mode: 'singleFile',
        source: {
          project: [ROO_CODE_ROOT_RULE, ROO_CODE_ROOT_RULE_FALLBACK],
          global: [ROO_CODE_GLOBAL_AGENTS_MD, ROO_CODE_ROOT_RULE, ROO_CODE_ROOT_RULE_FALLBACK],
        },
        canonicalDir: ROO_CODE_CANONICAL_RULES_DIR,
        canonicalRootFilename: '_root.md',
        markAsRoot: true,
        // Drop Roo-specific frontmatter fields; keep only canonical ones.
        frontmatterRemap: ({ description, globs }) => ({
          description: typeof description === 'string' ? description : undefined,
          globs: Array.isArray(globs) ? globs : undefined,
        }),
      },
      {
        // Non-root rule directory scan (skips `00-root.md`, handled above).
        feature: 'rules',
        mode: 'directory',
        source: { project: [ROO_CODE_RULES_DIR], global: [ROO_CODE_GLOBAL_RULES_DIR] },
        canonicalDir: ROO_CODE_CANONICAL_RULES_DIR,
        extensions: ['.md'],
        map: rooNonRootRuleMapper,
      },
    ],
    commands: {
      feature: 'commands',
      mode: 'directory',
      source: { project: [ROO_CODE_COMMANDS_DIR], global: [ROO_CODE_GLOBAL_COMMANDS_DIR] },
      canonicalDir: ROO_CODE_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      map: rooCommandMapper,
    },
    mcp: {
      feature: 'mcp',
      mode: 'mcpJson',
      source: { project: [ROO_CODE_MCP_FILE], global: [ROO_CODE_GLOBAL_MCP_FILE] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: ROO_CODE_CANONICAL_MCP,
    },
    ignore: {
      feature: 'ignore',
      mode: 'flatFile',
      source: { project: [ROO_CODE_IGNORE], global: [ROO_CODE_GLOBAL_IGNORE] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: ROO_CODE_CANONICAL_IGNORE,
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
    ROO_CODE_MODES_FILE,
  ],
} satisfies TargetDescriptor;
