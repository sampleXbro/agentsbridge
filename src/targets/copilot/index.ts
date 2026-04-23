import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateHooks,
  renderCopilotGlobalInstructions,
} from './generator.js';
import {
  COPILOT_INSTRUCTIONS,
  COPILOT_INSTRUCTIONS_DIR,
  COPILOT_AGENTS_DIR,
  COPILOT_PROMPTS_DIR,
  COPILOT_SKILLS_DIR,
  COPILOT_HOOKS_DIR,
  COPILOT_GLOBAL_INSTRUCTIONS,
  COPILOT_GLOBAL_AGENTS_DIR,
  COPILOT_GLOBAL_SKILLS_DIR,
  COPILOT_GLOBAL_PROMPTS_DIR,
  COPILOT_GLOBAL_AGENTS_SKILLS_DIR,
  COPILOT_GLOBAL_AGENTS_MD,
  COPILOT_GLOBAL_CLAUDE_SKILLS_DIR,
} from './constants.js';
import { importFromCopilot } from './importer.js';
import { lintRules } from './linter.js';
import { buildCopilotImportPaths } from '../../core/reference/import-map-builders.js';
import { commandPromptPath } from './command-prompt.js';
import { lintCommands, lintHooks } from './lint.js';
import { addHookScriptAssets } from './hook-assets.js';
import { generateCopilotGlobalExtras } from './scope-extras.js';

export const target: TargetGenerators = {
  name: 'copilot',
  primaryRootInstructionPath: COPILOT_INSTRUCTIONS,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateHooks,
  importFrom: importFromCopilot,
};

const project: TargetLayout = {
  rootInstructionPath: COPILOT_INSTRUCTIONS,
  outputFamilies: [{ id: 'instructions', kind: 'additional', pathPrefix: '.github/instructions/' }],
  skillDir: '.github/skills',
  managedOutputs: {
    dirs: [
      '.github/agents',
      '.github/instructions',
      '.github/prompts',
      '.github/skills',
      '.github/hooks/scripts',
    ],
    files: ['.github/copilot-instructions.md', '.github/hooks/agentsmesh.json'],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${COPILOT_INSTRUCTIONS_DIR}/${slug}.instructions.md`;
    },
    commandPath(name, _config) {
      return commandPromptPath(name);
    },
    agentPath(name, _config) {
      return `${COPILOT_AGENTS_DIR}/${name}.agent.md`;
    },
  },
};

const global: TargetLayout = {
  rootInstructionPath: COPILOT_GLOBAL_INSTRUCTIONS,
  renderPrimaryRootInstruction: renderCopilotGlobalInstructions,
  outputFamilies: [
    { id: 'compat-agents', kind: 'additional', explicitPaths: [COPILOT_GLOBAL_AGENTS_MD] },
  ],
  skillDir: COPILOT_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      COPILOT_GLOBAL_AGENTS_DIR,
      COPILOT_GLOBAL_SKILLS_DIR,
      COPILOT_GLOBAL_PROMPTS_DIR,
      COPILOT_GLOBAL_AGENTS_SKILLS_DIR,
      COPILOT_GLOBAL_CLAUDE_SKILLS_DIR,
    ],
    files: [COPILOT_GLOBAL_INSTRUCTIONS, COPILOT_GLOBAL_AGENTS_MD],
  },
  rewriteGeneratedPath(path) {
    // Transform project-level .github/ paths to global ~/.copilot/ paths
    if (path === COPILOT_INSTRUCTIONS) {
      return COPILOT_GLOBAL_INSTRUCTIONS;
    }
    if (path.startsWith(`${COPILOT_INSTRUCTIONS_DIR}/`)) {
      // Glob-scoped instructions aggregate into the single root instructions file in global mode
      return COPILOT_GLOBAL_INSTRUCTIONS;
    }
    if (path.startsWith(`${COPILOT_PROMPTS_DIR}/`)) {
      return path.replace(`${COPILOT_PROMPTS_DIR}/`, `${COPILOT_GLOBAL_PROMPTS_DIR}/`);
    }
    if (path.startsWith(`${COPILOT_AGENTS_DIR}/`)) {
      return path.replace(`${COPILOT_AGENTS_DIR}/`, `${COPILOT_GLOBAL_AGENTS_DIR}/`);
    }
    if (path.startsWith(`${COPILOT_SKILLS_DIR}/`)) {
      return path.replace(`${COPILOT_SKILLS_DIR}/`, `${COPILOT_GLOBAL_SKILLS_DIR}/`);
    }
    // Skip hooks in global mode
    if (path.startsWith(`${COPILOT_HOOKS_DIR}/`)) {
      return null;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    // Mirror ~/.copilot/skills/ to ~/.agents/skills/ and ~/.claude/skills/ unless codex-cli owns it
    if (path.startsWith(`${COPILOT_GLOBAL_SKILLS_DIR}/`) && !activeTargets.includes('codex-cli')) {
      const rel = path.slice(COPILOT_GLOBAL_SKILLS_DIR.length + 1);
      return [`.agents/skills/${rel}`, `${COPILOT_GLOBAL_CLAUDE_SKILLS_DIR}/${rel}`];
    }
    return null;
  },
  paths: {
    rulePath(_slug, _rule) {
      // Global mode uses single instructions file, not per-rule files
      return COPILOT_GLOBAL_INSTRUCTIONS;
    },
    commandPath(name, _config) {
      return `${COPILOT_GLOBAL_PROMPTS_DIR}/${name}.prompt.md`;
    },
    agentPath(name, _config) {
      return `${COPILOT_GLOBAL_AGENTS_DIR}/${name}.agent.md`;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'none',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: 'copilot',
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'native',
    commands: 'native',
    agents: 'native',
    skills: 'native',
    mcp: 'none',
    hooks: 'partial',
    ignore: 'none',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Copilot config found (.github/copilot-instructions.md, .github/copilot or .github/instructions, .github/prompts, .github/skills, .github/agents, or .github/hooks).',
  lintRules,
  lint: {
    commands: lintCommands,
    hooks: lintHooks,
  },
  postProcessHookOutputs: async (projectRoot, canonical, outputs) =>
    addHookScriptAssets(projectRoot, canonical, [...outputs]),
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      COPILOT_GLOBAL_INSTRUCTIONS,
      COPILOT_GLOBAL_AGENTS_MD,
      COPILOT_GLOBAL_AGENTS_DIR,
      COPILOT_GLOBAL_SKILLS_DIR,
      COPILOT_GLOBAL_PROMPTS_DIR,
      COPILOT_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    layout: global,
    scopeExtras: generateCopilotGlobalExtras,
  },
  skillDir: project.skillDir,
  paths: project.paths,
  buildImportPaths: buildCopilotImportPaths,
  detectionPaths: [
    '.github/copilot-instructions.md',
    '.github/copilot',
    '.github/instructions',
    '.github/prompts',
    '.github/skills',
    '.github/agents',
    '.github/hooks',
  ],
} satisfies TargetDescriptor;
