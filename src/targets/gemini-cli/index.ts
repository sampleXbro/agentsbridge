import type { TargetGenerators, TargetCapabilities } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateIgnore,
} from './generator.js';
import { cap } from '../catalog/capabilities.js';
import { generateGeminiPermissionsPolicies } from './policies-generator.js';
import {
  GEMINI_ROOT,
  GEMINI_COMPAT_AGENTS,
  GEMINI_COMMANDS_DIR,
  GEMINI_AGENTS_DIR,
  GEMINI_GLOBAL_ROOT,
  GEMINI_GLOBAL_COMPAT_AGENTS,
  GEMINI_GLOBAL_SETTINGS,
  GEMINI_GLOBAL_COMMANDS_DIR,
  GEMINI_GLOBAL_SKILLS_DIR,
  GEMINI_GLOBAL_AGENTS_DIR,
  GEMINI_SETTINGS,
} from './constants.js';
import { importFromGemini } from './importer.js';
import { lintRules } from './linter.js';
import { buildGeminiCliImportPaths } from '../../core/reference/import-map-builders.js';
import { shouldConvertAgentsToSkills } from '../../config/core/conversions.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';
import { lintCommands, lintHooks } from './lint.js';
import { emitScopedGeminiSettings } from './scoped-settings-emit.js';

export const target: TargetGenerators = {
  name: 'gemini-cli',
  primaryRootInstructionPath: GEMINI_ROOT,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateIgnore,
  generatePermissions: generateGeminiPermissionsPolicies,
  importFrom: importFromGemini,
};

const project: TargetLayout = {
  rootInstructionPath: GEMINI_ROOT,
  outputFamilies: [
    { id: 'compat-agents', kind: 'additional', explicitPaths: [GEMINI_COMPAT_AGENTS] },
  ],
  skillDir: '.gemini/skills',
  managedOutputs: {
    dirs: ['.gemini/agents', '.gemini/commands', '.gemini/skills', '.agents/skills'],
    files: [
      'AGENTS.md',
      'GEMINI.md',
      '.gemini/settings.json',
      '.gemini/policies/permissions.toml',
      '.geminiignore',
    ],
  },
  // `AGENTS.md` rewrites skill links to `.agents/skills/…` for cross-tool compatibility; mirror
  // project skills there so link validation and consumers see real files (same as global layout).
  mirrorGlobalPath(path, activeTargets) {
    if (path.startsWith('.gemini/skills/') && !activeTargets.includes('codex-cli')) {
      return path.replace(/^\.gemini\/skills\//, '.agents/skills/');
    }
    return null;
  },
  paths: {
    rulePath(_slug, _rule) {
      return GEMINI_ROOT;
    },
    commandPath(name, _config) {
      if (name.includes(':')) {
        const parts = name.split(':').filter(Boolean);
        const fileBase = parts.pop() ?? name;
        const dirs = parts;
        return `${GEMINI_COMMANDS_DIR}/${dirs.join('/')}/${fileBase}.toml`;
      }
      return `${GEMINI_COMMANDS_DIR}/${name}.toml`;
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'gemini-cli')
        ? `.gemini/skills/${projectedAgentSkillDirName(name)}/SKILL.md`
        : `${GEMINI_AGENTS_DIR}/${name}.md`;
    },
  },
};

const global: TargetLayout = {
  rootInstructionPath: GEMINI_GLOBAL_ROOT,
  outputFamilies: [
    { id: 'compat-agents', kind: 'additional', explicitPaths: [GEMINI_GLOBAL_COMPAT_AGENTS] },
  ],
  skillDir: GEMINI_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [GEMINI_GLOBAL_COMMANDS_DIR, GEMINI_GLOBAL_SKILLS_DIR, GEMINI_GLOBAL_AGENTS_DIR],
    files: [GEMINI_GLOBAL_ROOT, GEMINI_GLOBAL_COMPAT_AGENTS, GEMINI_GLOBAL_SETTINGS],
  },
  rewriteGeneratedPath(path) {
    // Transform project-level paths to global ~/.gemini/ paths
    if (path === GEMINI_ROOT) {
      return GEMINI_GLOBAL_ROOT;
    }
    if (path === GEMINI_COMPAT_AGENTS) {
      return GEMINI_GLOBAL_COMPAT_AGENTS;
    }
    if (path === GEMINI_SETTINGS) {
      return GEMINI_GLOBAL_SETTINGS;
    }
    if (path.startsWith(`${GEMINI_COMMANDS_DIR}/`)) {
      return path.replace(`${GEMINI_COMMANDS_DIR}/`, `${GEMINI_GLOBAL_COMMANDS_DIR}/`);
    }
    if (path.startsWith('.gemini/skills/')) {
      return path.replace('.gemini/skills/', `${GEMINI_GLOBAL_SKILLS_DIR}/`);
    }
    if (path.startsWith(`${GEMINI_AGENTS_DIR}/`)) {
      return path.replace(`${GEMINI_AGENTS_DIR}/`, `${GEMINI_GLOBAL_AGENTS_DIR}/`);
    }
    // Skip policies and ignore in global mode
    if (path.startsWith('.gemini/policies/') || path === '.geminiignore') {
      return null;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    // Mirror ~/.gemini/skills/ to ~/.agents/skills/ unless codex-cli already owns it
    if (path.startsWith(`${GEMINI_GLOBAL_SKILLS_DIR}/`) && !activeTargets.includes('codex-cli')) {
      return `.agents/skills/${path.slice(GEMINI_GLOBAL_SKILLS_DIR.length + 1)}`;
    }
    return null;
  },
  paths: {
    rulePath(_slug, _rule) {
      // Global mode uses single instructions file, not per-rule files
      return GEMINI_GLOBAL_ROOT;
    },
    commandPath(name, _config) {
      if (name.includes(':')) {
        const parts = name.split(':').filter(Boolean);
        const fileBase = parts.pop() ?? name;
        const dirs = parts;
        return `${GEMINI_GLOBAL_COMMANDS_DIR}/${dirs.join('/')}/${fileBase}.toml`;
      }
      return `${GEMINI_GLOBAL_COMMANDS_DIR}/${name}.toml`;
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'gemini-cli')
        ? `${GEMINI_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`
        : `${GEMINI_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'partial',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: 'gemini-cli',
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'embedded',
    commands: 'native',
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'partial',
    ignore: cap('native', 'settings-embedded'),
    permissions: 'partial',
  },
  emptyImportMessage:
    'No Gemini CLI config found (GEMINI.md or .gemini/rules, .gemini/commands, .gemini/settings.json).',
  lintRules,
  lint: {
    commands: lintCommands,
    hooks: lintHooks,
  },
  emitScopedSettings: emitScopedGeminiSettings,
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      GEMINI_GLOBAL_ROOT,
      GEMINI_GLOBAL_COMPAT_AGENTS,
      GEMINI_GLOBAL_SETTINGS,
      GEMINI_GLOBAL_COMMANDS_DIR,
      GEMINI_GLOBAL_SKILLS_DIR,
      GEMINI_GLOBAL_AGENTS_DIR,
    ],
    layout: global,
  },
  skillDir: project.skillDir,
  paths: project.paths,
  buildImportPaths: buildGeminiCliImportPaths,
  detectionPaths: ['GEMINI.md', '.gemini'],
} satisfies TargetDescriptor;
