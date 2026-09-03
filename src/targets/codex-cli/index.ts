import { basename } from 'node:path';
import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generatePermissions,
  renderCodexGlobalInstructions,
} from './generator.js';
import {
  AGENTS_MD,
  CODEX_GLOBAL_AGENTS_MD,
  CODEX_SKILLS_DIR,
  CODEX_AGENTS_DIR,
  CODEX_INSTRUCTIONS_DIR,
  CODEX_RULES_DIR,
  CODEX_HOOKS_FILE,
} from './constants.js';
import { importFromCodex } from './importer.js';
import { lintRules } from './linter.js';
import { lintMcp, lintHooks } from './lint.js';
import { buildCodexCliImportPaths } from '../../core/reference/import-map-builders.js';
import { shouldConvertCommandsToSkills } from '../../config/core/conversions.js';
import { codexNestedAgentsPath } from './codex-rule-paths.js';
import { commandSkillDirName } from './command-skill.js';
import { mergeCodexConfigToml } from './config-merge.js';

export const target: TargetGenerators = {
  name: 'codex-cli',
  primaryRootInstructionPath: AGENTS_MD,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generatePermissions,
  importFrom: importFromCodex,
};

function codexRulePath(rule: Parameters<TargetLayout['paths']['rulePath']>[1]): string {
  if (rule.codexEmit === 'execution') {
    const slug = basename(rule.source, '.md');
    return `${CODEX_RULES_DIR}/${slug}.rules`;
  }
  return codexNestedAgentsPath(rule);
}

const project: TargetLayout = {
  rootInstructionPath: AGENTS_MD,
  extraRuleOutputPaths(rule) {
    if (rule.root || rule.codexEmit !== 'execution') return [];
    const slug = basename(rule.source, '.md');
    return [`${CODEX_RULES_DIR}/${slug}.rules`];
  },
  skillDir: '.agents/skills',
  managedOutputs: {
    dirs: ['.agents/skills', '.codex/agents', '.codex/instructions', '.codex/rules'],
    files: ['AGENTS.md', '.codex/config.toml', CODEX_HOOKS_FILE],
  },
  paths: {
    rulePath(_slug, rule) {
      return codexRulePath(rule);
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

const globalLayout: TargetLayout = {
  rootInstructionPath: CODEX_GLOBAL_AGENTS_MD,
  renderPrimaryRootInstruction: renderCodexGlobalInstructions,
  extraRuleOutputPaths(rule) {
    if (rule.root || rule.codexEmit !== 'execution') return [];
    const slug = basename(rule.source, '.md');
    return [`${CODEX_RULES_DIR}/${slug}.rules`];
  },
  skillDir: CODEX_SKILLS_DIR,
  managedOutputs: {
    dirs: ['.agents/skills', '.codex/agents', '.codex/rules'],
    files: [CODEX_GLOBAL_AGENTS_MD, '.codex/config.toml', CODEX_HOOKS_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === AGENTS_MD) return CODEX_GLOBAL_AGENTS_MD;
    // Advisory rules nest as `<dir>/AGENTS(.override).md` at project scope (see
    // codex-rule-paths.ts); global scope embeds them into CODEX_GLOBAL_AGENTS_MD
    // instead (renderCodexGlobalInstructions), so nested paths are suppressed here.
    if (/\/AGENTS(\.override)?\.md$/.test(path)) return null;
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
  hooks: 'native',
  ignore: 'none',
  permissions: 'native',
};

export const descriptor = {
  id: 'codex-cli',
  metadata: {
    displayName: 'Codex CLI',
    category: 'cli',
    officialUrl: 'https://github.com/openai/codex',
    shortDescription: "OpenAI's terminal coding agent",
  },
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'native',
    commands: 'embedded',
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'native',
    ignore: 'none',
    permissions: 'native',
  },
  emptyImportMessage: 'No Codex config found (codex.md or AGENTS.md).',
  supportsConversion: { commands: true },
  lintRules,
  lint: {
    mcp: lintMcp,
    hooks: lintHooks,
  },
  mergeGeneratedOutputContent: mergeCodexConfigToml,
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      '.codex/AGENTS.md',
      '.codex/AGENTS.override.md',
      '.codex/config.toml',
      '.codex/agents',
      '.codex/rules',
      CODEX_HOOKS_FILE,
      '.agents/skills',
    ],
    layout: globalLayout,
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
    CODEX_HOOKS_FILE,
  ],
  nativeInstall: {
    pickPaths: [
      { prefix: '.codex', feature: 'rules', strategy: { kind: 'basename', suffix: '.md' } },
    ],
  },
  excludeFromStarterInit: true,
  conversionDefaults: { commandsToSkills: true, agentsToSkills: false },
} satisfies TargetDescriptor;
