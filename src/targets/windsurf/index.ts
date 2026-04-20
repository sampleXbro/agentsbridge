import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateIgnore,
  generateMcp,
  generateHooks,
} from './generator.js';
import { cap } from '../catalog/capabilities.js';
import {
  WINDSURF_AGENTS_MD,
  WINDSURF_RULES_DIR,
  WINDSURF_WORKFLOWS_DIR,
  WINDSURF_SKILLS_DIR,
  WINDSURF_HOOKS_FILE,
  WINDSURF_MCP_EXAMPLE_FILE,
  CODEIUM_IGNORE,
  WINDSURF_GLOBAL_RULES,
  WINDSURF_GLOBAL_SKILLS_DIR,
  WINDSURF_GLOBAL_WORKFLOWS_DIR,
  WINDSURF_GLOBAL_HOOKS_FILE,
  WINDSURF_GLOBAL_MCP_FILE,
  WINDSURF_GLOBAL_IGNORE,
  WINDSURF_GLOBAL_AGENTS_SKILLS_DIR,
} from './constants.js';
import { importFromWindsurf } from './importer.js';
import { lintRules } from './linter.js';
import { lintCommands, lintMcp } from './lint.js';
import { buildWindsurfImportPaths } from '../../core/reference/import-map-builders.js';
import { shouldConvertAgentsToSkills } from '../../config/core/conversions.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';

export const target: TargetGenerators = {
  name: 'windsurf',
  primaryRootInstructionPath: WINDSURF_AGENTS_MD,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromWindsurf,
};

const project: TargetLayout = {
  rootInstructionPath: WINDSURF_AGENTS_MD,
  skillDir: WINDSURF_SKILLS_DIR,
  managedOutputs: {
    dirs: ['.windsurf/rules', '.windsurf/skills', '.windsurf/workflows'],
    files: [
      'AGENTS.md',
      'src/AGENTS.md',
      '.codeiumignore',
      '.windsurf/hooks.json',
      '.windsurf/mcp_config.example.json',
    ],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${WINDSURF_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${WINDSURF_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'windsurf')
        ? `.windsurf/skills/${projectedAgentSkillDirName(name)}/SKILL.md`
        : null;
    },
  },
};

const global: TargetLayout = {
  rootInstructionPath: WINDSURF_GLOBAL_RULES,
  skillDir: WINDSURF_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      WINDSURF_GLOBAL_SKILLS_DIR,
      WINDSURF_GLOBAL_WORKFLOWS_DIR,
      WINDSURF_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [
      WINDSURF_GLOBAL_RULES,
      WINDSURF_GLOBAL_HOOKS_FILE,
      WINDSURF_GLOBAL_MCP_FILE,
      WINDSURF_GLOBAL_IGNORE,
    ],
  },
  rewriteGeneratedPath(path) {
    // Transform project-level paths to global ~/.codeium/windsurf/ paths
    if (path === WINDSURF_AGENTS_MD) {
      return WINDSURF_GLOBAL_RULES;
    }
    if (path.startsWith(`${WINDSURF_RULES_DIR}/`) || /\/AGENTS\.md$/.test(path)) {
      return null; // Per-rule files and directory-scoped AGENTS.md suppressed; root AGENTS.md provides primary content
    }
    if (path.startsWith(`${WINDSURF_SKILLS_DIR}/`)) {
      return path.replace(`${WINDSURF_SKILLS_DIR}/`, `${WINDSURF_GLOBAL_SKILLS_DIR}/`);
    }
    if (path.startsWith(`${WINDSURF_WORKFLOWS_DIR}/`)) {
      return path.replace(`${WINDSURF_WORKFLOWS_DIR}/`, `${WINDSURF_GLOBAL_WORKFLOWS_DIR}/`);
    }
    if (path === WINDSURF_HOOKS_FILE) {
      return WINDSURF_GLOBAL_HOOKS_FILE;
    }
    if (path === WINDSURF_MCP_EXAMPLE_FILE) {
      return WINDSURF_GLOBAL_MCP_FILE;
    }
    if (path === CODEIUM_IGNORE) {
      return WINDSURF_GLOBAL_IGNORE;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    // Mirror ~/.codeium/windsurf/skills/ to ~/.agents/skills/ unless codex-cli already owns it
    if (path.startsWith('.codeium/windsurf/skills/') && !activeTargets.includes('codex-cli')) {
      return path.replace(/^\.codeium\/windsurf\/skills\//, '.agents/skills/');
    }
    return null;
  },
  paths: {
    rulePath(_slug, _rule) {
      return WINDSURF_GLOBAL_RULES; // All rules go to global_rules.md
    },
    commandPath(name, _config) {
      return `${WINDSURF_GLOBAL_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'windsurf')
        ? `${WINDSURF_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`
        : null;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  commands: cap('native', 'workflows'),
  agents: 'embedded',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'native',
  permissions: 'none',
};

export const descriptor = {
  id: 'windsurf',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: cap('native', 'workflows'),
    agents: 'embedded',
    skills: 'native',
    mcp: 'partial',
    hooks: 'native',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Windsurf config found (.windsurfrules, .windsurf/rules, .windsurfignore, or .codeiumignore).',
  supportsConversion: { agents: true },
  lintRules,
  lint: {
    commands: lintCommands,
    mcp: lintMcp,
  },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      WINDSURF_GLOBAL_RULES,
      WINDSURF_GLOBAL_SKILLS_DIR,
      WINDSURF_GLOBAL_WORKFLOWS_DIR,
      WINDSURF_GLOBAL_HOOKS_FILE,
      WINDSURF_GLOBAL_MCP_FILE,
      WINDSURF_GLOBAL_IGNORE,
    ],
    layout: global,
  },
  skillDir: project.skillDir,
  paths: project.paths,
  buildImportPaths: buildWindsurfImportPaths,
  detectionPaths: ['.windsurfrules', '.windsurf'],
} satisfies TargetDescriptor;
