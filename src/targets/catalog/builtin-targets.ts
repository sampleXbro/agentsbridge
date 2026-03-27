import type { CanonicalFiles, LintDiagnostic, SupportLevel } from '../../core/types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  shouldConvertAgentsToSkills,
  shouldConvertCommandsToSkills,
} from '../../config/core/conversions.js';
import type { TargetCapabilities, TargetGenerators } from './target.interface.js';
import { target as claudeCodeTarget } from '../claude-code/index.js';
import { target as cursorTarget } from '../cursor/index.js';
import { target as copilotTarget } from '../copilot/index.js';
import { target as continueTarget } from '../continue/index.js';
import { target as junieTarget } from '../junie/index.js';
import { target as geminiTarget } from '../gemini-cli/index.js';
import { target as clineTarget } from '../cline/index.js';
import { target as codexTarget } from '../codex-cli/index.js';
import { target as windsurfTarget } from '../windsurf/index.js';
import { lintRules as claudeCodeLintRules } from '../claude-code/linter.js';
import { lintRules as cursorLintRules } from '../cursor/linter.js';
import { lintRules as copilotLintRules } from '../copilot/linter.js';
import { lintRules as continueLintRules } from '../continue/linter.js';
import { lintRules as junieLintRules } from '../junie/linter.js';
import { lintRules as geminiLintRules } from '../gemini-cli/linter.js';
import { lintRules as clineLintRules } from '../cline/linter.js';
import { lintRules as codexLintRules } from '../codex-cli/linter.js';
import { lintRules as windsurfLintRules } from '../windsurf/linter.js';

type RuleLinter = (
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
) => LintDiagnostic[];

type TargetFeature = keyof TargetCapabilities | 'settings';
type TargetGenerator = (canonical: CanonicalFiles) => { path: string; content: string }[];

export interface BuiltinTargetDefinition {
  id: string;
  generators: TargetGenerators;
  capabilities: TargetCapabilities;
  emptyImportMessage: string;
  lintRules: RuleLinter | null;
  skillDir?: string;
}

export const BUILTIN_TARGETS = [
  {
    id: 'claude-code',
    generators: claudeCodeTarget,
    capabilities: {
      rules: 'native',
      commands: 'native',
      agents: 'native',
      skills: 'native',
      mcp: 'native',
      hooks: 'native',
      ignore: 'native',
      permissions: 'native',
    },
    emptyImportMessage: 'No Claude Code config found (CLAUDE.md or .claude/rules/*.md).',
    lintRules: claudeCodeLintRules,
    skillDir: '.claude/skills',
  },
  {
    id: 'cursor',
    generators: cursorTarget,
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
    emptyImportMessage: 'No Cursor config found (AGENTS.md or .cursor/rules/*.mdc).',
    lintRules: cursorLintRules,
    skillDir: '.cursor/skills',
  },
  {
    id: 'copilot',
    generators: copilotTarget,
    capabilities: {
      rules: 'native',
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
    lintRules: copilotLintRules,
    skillDir: '.github/skills',
  },
  {
    id: 'continue',
    generators: continueTarget,
    capabilities: {
      rules: 'native',
      commands: 'embedded',
      agents: 'none',
      skills: 'embedded',
      mcp: 'native',
      hooks: 'none',
      ignore: 'none',
      permissions: 'none',
    },
    emptyImportMessage:
      'No Continue config found (.continue/rules/*.md, .continue/skills, or .continue/mcpServers/*).',
    lintRules: continueLintRules,
    skillDir: '.continue/skills',
  },
  {
    id: 'junie',
    generators: junieTarget,
    capabilities: {
      rules: 'native',
      commands: 'embedded',
      agents: 'embedded',
      skills: 'embedded',
      mcp: 'native',
      hooks: 'none',
      ignore: 'native',
      permissions: 'none',
    },
    emptyImportMessage:
      'No Junie config found (.junie/guidelines.md, .junie/AGENTS.md, .junie/skills, .junie/mcp/mcp.json, or .aiignore).',
    lintRules: junieLintRules,
    skillDir: '.junie/skills',
  },
  {
    id: 'gemini-cli',
    generators: geminiTarget,
    capabilities: {
      rules: 'native',
      commands: 'native',
      agents: 'native',
      skills: 'native',
      mcp: 'native',
      hooks: 'partial',
      ignore: 'native',
      permissions: 'partial',
    },
    emptyImportMessage:
      'No Gemini CLI config found (GEMINI.md or .gemini/rules, .gemini/commands, .gemini/settings.json).',
    lintRules: geminiLintRules,
    skillDir: '.gemini/skills',
  },
  {
    id: 'cline',
    generators: clineTarget,
    capabilities: {
      rules: 'native',
      commands: 'native',
      agents: 'embedded',
      skills: 'native',
      mcp: 'native',
      hooks: 'none',
      ignore: 'native',
      permissions: 'none',
    },
    emptyImportMessage:
      'No Cline config found (.clinerules, .clineignore, .cline/cline_mcp_settings.json, or .cline/skills).',
    lintRules: clineLintRules,
    skillDir: '.cline/skills',
  },
  {
    id: 'codex-cli',
    generators: codexTarget,
    capabilities: {
      rules: 'native',
      commands: 'embedded',
      agents: 'native',
      skills: 'native',
      mcp: 'native',
      hooks: 'none',
      ignore: 'none',
      permissions: 'none',
    },
    emptyImportMessage: 'No Codex config found (codex.md or AGENTS.md).',
    lintRules: codexLintRules,
    skillDir: '.agents/skills',
  },
  {
    id: 'windsurf',
    generators: windsurfTarget,
    capabilities: {
      rules: 'native',
      commands: 'native',
      agents: 'embedded',
      skills: 'native',
      mcp: 'partial',
      hooks: 'native',
      ignore: 'native',
      permissions: 'none',
    },
    emptyImportMessage:
      'No Windsurf config found (.windsurfrules, .windsurf/rules, .windsurfignore, or .codeiumignore).',
    lintRules: windsurfLintRules,
    skillDir: '.windsurf/skills',
  },
] as const satisfies readonly BuiltinTargetDefinition[];

export type BuiltinTargetId = (typeof BUILTIN_TARGETS)[number]['id'];
export const TARGET_IDS = BUILTIN_TARGETS.map((target) => target.id) as BuiltinTargetId[];

export function isBuiltinTargetId(value: string): value is BuiltinTargetId {
  return BUILTIN_TARGETS.some((target) => target.id === value);
}

export function getBuiltinTargetDefinition(target: string): BuiltinTargetDefinition | undefined {
  return BUILTIN_TARGETS.find((candidate) => candidate.id === target);
}

export function getTargetSkillDir(target: string): string | undefined {
  return getBuiltinTargetDefinition(target)?.skillDir;
}

export function getEffectiveTargetSupportLevel(
  target: string,
  feature: keyof TargetCapabilities,
  config: ValidatedConfig,
): SupportLevel {
  const definition = getBuiltinTargetDefinition(target);
  const baseLevel = definition?.capabilities[feature] ?? 'none';
  if (baseLevel !== 'embedded') return baseLevel;
  if (feature === 'commands' && target === 'codex-cli') {
    return shouldConvertCommandsToSkills(config, target) ? 'embedded' : 'none';
  }
  if (feature === 'agents' && (target === 'cline' || target === 'windsurf')) {
    return shouldConvertAgentsToSkills(config, target) ? 'embedded' : 'none';
  }
  return baseLevel;
}

export function resolveTargetFeatureGenerator(
  target: string,
  feature: TargetFeature,
  config?: ValidatedConfig,
): TargetGenerator | undefined {
  const generators = getBuiltinTargetDefinition(target)?.generators;
  if (!generators) return undefined;

  switch (feature) {
    case 'rules':
      return generators.generateRules;
    case 'commands':
      if (target === 'codex-cli' && config && !shouldConvertCommandsToSkills(config, target)) {
        return undefined;
      }
      return generators.generateWorkflows ?? generators.generateCommands;
    case 'agents':
      if (
        config &&
        (target === 'cline' || target === 'windsurf') &&
        !shouldConvertAgentsToSkills(config, target)
      ) {
        return undefined;
      }
      return generators.generateAgents;
    case 'skills':
      return generators.generateSkills;
    case 'mcp':
      return generators.generateMcp;
    case 'permissions':
      return generators.generatePermissions;
    case 'hooks':
      return generators.generateHooks;
    case 'ignore':
      return generators.generateIgnore;
    case 'settings':
      return generators.generateSettings;
  }
}
