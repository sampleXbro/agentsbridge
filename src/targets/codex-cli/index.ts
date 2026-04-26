import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  renderCodexGlobalInstructions,
} from './generator.js';
import {
  AGENTS_MD,
  CODEX_GLOBAL_AGENTS_MD,
  CODEX_SKILLS_DIR,
  CODEX_AGENTS_DIR,
  CODEX_INSTRUCTIONS_DIR,
  CODEX_RULES_DIR,
} from './constants.js';
import { importFromCodex } from './importer.js';
import { lintRules } from './linter.js';
import { lintMcp } from './lint.js';
import { buildCodexCliImportPaths } from '../../core/reference/import-map-builders.js';
import { shouldConvertCommandsToSkills } from '../../config/core/conversions.js';
import { codexAdvisoryInstructionPath } from './codex-rule-paths.js';
import { commandSkillDirName } from './command-skill.js';

export const target: TargetGenerators = {
  name: 'codex-cli',
  primaryRootInstructionPath: AGENTS_MD,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  importFrom: importFromCodex,
};

const project: TargetLayout = {
  rootInstructionPath: AGENTS_MD,
  extraRuleOutputPaths(rule) {
    if (rule.root || rule.codexEmit !== 'execution') return [];
    const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
    return [`${CODEX_RULES_DIR}/${slug}.rules`];
  },
  skillDir: '.agents/skills',
  managedOutputs: {
    dirs: ['.agents/skills', '.codex/agents', '.codex/instructions'],
    files: ['AGENTS.md', '.codex/config.toml'],
  },
  paths: {
    rulePath(_slug, rule) {
      return codexAdvisoryInstructionPath(rule);
    },
    commandPath(name, config: ValidatedConfig) {
      return shouldConvertCommandsToSkills(config, 'codex-cli')
        ? `${CODEX_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`
        : null;
    },
    agentPath(name, _config) {
      return `${CODEX_AGENTS_DIR}/${name}.toml`;
    },
  },
};

const global: TargetLayout = {
  rootInstructionPath: CODEX_GLOBAL_AGENTS_MD,
  renderPrimaryRootInstruction: renderCodexGlobalInstructions,
  extraRuleOutputPaths(rule) {
    if (rule.root || rule.codexEmit !== 'execution') return [];
    const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
    return [`${CODEX_RULES_DIR}/${slug}.rules`];
  },
  skillDir: CODEX_SKILLS_DIR,
  managedOutputs: {
    dirs: ['.agents/skills', '.codex/agents', '.codex/rules'],
    files: [CODEX_GLOBAL_AGENTS_MD, '.codex/config.toml'],
  },
  rewriteGeneratedPath(path) {
    if (path === AGENTS_MD) return CODEX_GLOBAL_AGENTS_MD;
    if (path.startsWith(`${CODEX_INSTRUCTIONS_DIR}/`)) return null;
    return path;
  },
  paths: {
    rulePath(slug, rule) {
      return rule.codexEmit === 'execution'
        ? `${CODEX_RULES_DIR}/${slug}.rules`
        : CODEX_GLOBAL_AGENTS_MD;
    },
    commandPath(name, config: ValidatedConfig) {
      return shouldConvertCommandsToSkills(config, 'codex-cli')
        ? `${CODEX_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`
        : null;
    },
    agentPath(name, _config) {
      return `${CODEX_AGENTS_DIR}/${name}.toml`;
    },
  },
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'embedded',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

export const descriptor = {
  id: 'codex-cli',
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'native',
    commands: 'embedded',
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'none',
    ignore: 'none',
    permissions: 'none',
  },
  emptyImportMessage: 'No Codex config found (codex.md or AGENTS.md).',
  supportsConversion: { commands: true },
  lintRules,
  lint: {
    mcp: lintMcp,
  },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      '.codex/AGENTS.md',
      '.codex/AGENTS.override.md',
      '.codex/config.toml',
      '.codex/agents',
      '.codex/rules',
      '.agents/skills',
    ],
    layout: global,
  },
  buildImportPaths: buildCodexCliImportPaths,
  sharedArtifacts: {
    '.agents/skills/': 'owner',
  },
  detectionPaths: [
    'codex.md',
    'AGENTS.md',
    'AGENTS.override.md',
    '.codex/config.toml',
    '.codex/agents',
    '.codex/rules',
  ],
} satisfies TargetDescriptor;
