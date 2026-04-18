import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateHooks,
} from './generator.js';
import {
  CLINE_AGENTS_MD,
  CLINE_RULES_DIR,
  CLINE_WORKFLOWS_DIR,
  CLINE_HOOKS_DIR,
  CLINE_SKILLS_DIR,
  CLINE_MCP_SETTINGS,
  CLINE_IGNORE,
  CLINE_GLOBAL_RULES_DIR,
  CLINE_GLOBAL_WORKFLOWS_DIR,
  CLINE_GLOBAL_HOOKS_DIR,
} from './constants.js';
import { importFromCline } from './importer.js';
import { lintRules } from './linter.js';
import { buildClineImportPaths } from '../../core/reference/import-map-builders.js';
import { shouldConvertAgentsToSkills } from '../../config/core/conversions.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';

export const target: TargetGenerators = {
  name: 'cline',
  primaryRootInstructionPath: CLINE_AGENTS_MD,
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromCline,
};

const project: TargetLayout = {
  rootInstructionPath: CLINE_AGENTS_MD,
  skillDir: '.cline/skills',
  managedOutputs: {
    dirs: ['.cline/skills', '.clinerules/hooks', '.clinerules/workflows'],
    files: [
      'AGENTS.md',
      '.cline/cline_mcp_settings.json',
      '.clineignore',
      '.clinerules/typescript.md',
    ],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${CLINE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${CLINE_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'cline')
        ? `.cline/skills/${projectedAgentSkillDirName(name)}/SKILL.md`
        : null;
    },
  },
};

const globalLayout: TargetLayout = {
  skillDir: CLINE_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      CLINE_GLOBAL_RULES_DIR,
      CLINE_GLOBAL_WORKFLOWS_DIR,
      CLINE_GLOBAL_HOOKS_DIR,
      CLINE_SKILLS_DIR,
      '.agents/skills',
    ],
    files: [CLINE_MCP_SETTINGS, CLINE_IGNORE],
  },
  rewriteGeneratedPath(path) {
    if (path === CLINE_AGENTS_MD) return null;
    if (path.startsWith(`${CLINE_HOOKS_DIR}/`)) {
      return `${CLINE_GLOBAL_HOOKS_DIR}/${path.slice(CLINE_HOOKS_DIR.length + 1)}`;
    }
    if (path.startsWith(`${CLINE_WORKFLOWS_DIR}/`)) {
      return `${CLINE_GLOBAL_WORKFLOWS_DIR}/${path.slice(CLINE_WORKFLOWS_DIR.length + 1)}`;
    }
    if (path.startsWith(`${CLINE_RULES_DIR}/`)) {
      return `${CLINE_GLOBAL_RULES_DIR}/${path.slice(CLINE_RULES_DIR.length + 1)}`;
    }
    return path;
  },
  mirrorGlobalPath(path, _activeTargets) {
    if (path.startsWith(`${CLINE_SKILLS_DIR}/`)) {
      return `.agents/skills/${path.slice(CLINE_SKILLS_DIR.length + 1)}`;
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
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'cline')
        ? `.cline/skills/${projectedAgentSkillDirName(name)}/SKILL.md`
        : null;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  commands: 'native',
  agents: 'embedded',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'native',
  permissions: 'none',
};

export const descriptor = {
  id: 'cline',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'native',
    agents: 'embedded',
    skills: 'native',
    mcp: 'native',
    hooks: 'native',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Cline config found (.clinerules, .clineignore, .cline/cline_mcp_settings.json, or .cline/skills).',
  supportsConversion: { agents: true },
  lintRules,
  project,
  global: globalLayout,
  globalCapabilities,
  skillDir: project.skillDir,
  paths: project.paths,
  buildImportPaths: buildClineImportPaths,
  detectionPaths: ['.clinerules', '.cline'],
  globalDetectionPaths: [
    CLINE_GLOBAL_RULES_DIR,
    CLINE_GLOBAL_WORKFLOWS_DIR,
    CLINE_GLOBAL_HOOKS_DIR,
    CLINE_SKILLS_DIR,
    CLINE_MCP_SETTINGS,
    CLINE_IGNORE,
  ],
} satisfies TargetDescriptor;
