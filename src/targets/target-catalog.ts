import type { CanonicalFiles, ImportResult, LintDiagnostic } from '../core/types.js';
import { importFromClaudeCode } from './claude-code/importer.js';
import { importFromCline } from './cline/importer.js';
import { importFromCursor } from './cursor/importer.js';
import { importFromCodex } from './codex-cli/importer.js';
import { importFromWindsurf } from './windsurf/importer.js';
import { importFromCopilot } from './copilot/importer.js';
import { importFromContinue } from './continue/importer.js';
import { importFromJunie } from './junie/importer.js';
import { importFromGemini } from './gemini-cli/importer.js';
import { lintRules as claudeCodeLintRules } from './claude-code/linter.js';
import { lintRules as cursorLintRules } from './cursor/linter.js';
import { lintRules as copilotLintRules } from './copilot/linter.js';
import { lintRules as continueLintRules } from './continue/linter.js';
import { lintRules as junieLintRules } from './junie/linter.js';
import { lintRules as geminiLintRules } from './gemini-cli/linter.js';
import { lintRules as clineLintRules } from './cline/linter.js';
import { lintRules as codexLintRules } from './codex-cli/linter.js';
import { lintRules as windsurfLintRules } from './windsurf/linter.js';
import type { TargetCapabilities } from './target.interface.js';

export const TARGET_IDS = [
  'claude-code',
  'cursor',
  'copilot',
  'continue',
  'junie',
  'gemini-cli',
  'cline',
  'codex-cli',
  'windsurf',
] as const;

export type BuiltinTargetId = (typeof TARGET_IDS)[number];

type RuleLinter = (
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
) => LintDiagnostic[];

interface TargetCatalogEntry {
  importFrom: (root: string) => Promise<ImportResult[]>;
  emptyImportMessage: string;
  lintRules: RuleLinter | null;
  capabilities: TargetCapabilities;
}

export const TARGET_CATALOG: Record<BuiltinTargetId, TargetCatalogEntry> = {
  'claude-code': {
    importFrom: importFromClaudeCode,
    emptyImportMessage: 'No Claude Code config found (CLAUDE.md or .claude/rules/*.md).',
    lintRules: claudeCodeLintRules,
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
  },
  cursor: {
    importFrom: importFromCursor,
    emptyImportMessage: 'No Cursor config found (AGENTS.md or .cursor/rules/*.mdc).',
    lintRules: cursorLintRules,
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
  },
  copilot: {
    importFrom: importFromCopilot,
    emptyImportMessage:
      'No Copilot config found (.github/copilot-instructions.md, .github/copilot or .github/instructions, .github/prompts, .github/skills, .github/agents, or .github/hooks).',
    lintRules: copilotLintRules,
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
  },
  continue: {
    importFrom: importFromContinue,
    emptyImportMessage:
      'No Continue config found (.continue/rules/*.md, .continue/skills, or .continue/mcpServers/*).',
    lintRules: continueLintRules,
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
  },
  junie: {
    importFrom: importFromJunie,
    emptyImportMessage:
      'No Junie config found (.junie/guidelines.md, .junie/AGENTS.md, .junie/skills, .junie/mcp/mcp.json, or .aiignore).',
    lintRules: junieLintRules,
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
  },
  'gemini-cli': {
    importFrom: importFromGemini,
    emptyImportMessage:
      'No Gemini CLI config found (GEMINI.md or .gemini/rules, .gemini/commands, .gemini/settings.json).',
    lintRules: geminiLintRules,
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
  },
  cline: {
    importFrom: importFromCline,
    emptyImportMessage:
      'No Cline config found (.clinerules, .clineignore, .cline/mcp_settings.json, or .cline/skills).',
    lintRules: clineLintRules,
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
  },
  'codex-cli': {
    importFrom: importFromCodex,
    emptyImportMessage: 'No Codex config found (codex.md or AGENTS.md).',
    lintRules: codexLintRules,
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
  },
  windsurf: {
    importFrom: importFromWindsurf,
    emptyImportMessage:
      'No Windsurf config found (.windsurfrules, .windsurf/rules, .windsurfignore, or .codeiumignore).',
    lintRules: windsurfLintRules,
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
  },
};

export function isBuiltinTargetId(value: string): value is BuiltinTargetId {
  return TARGET_IDS.includes(value as BuiltinTargetId);
}

export function getTargetCatalogEntry(id: BuiltinTargetId): TargetCatalogEntry {
  return TARGET_CATALOG[id];
}
