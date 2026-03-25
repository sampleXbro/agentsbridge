import { basename } from 'node:path';
import type { CanonicalFiles } from './types.js';
import type { ValidatedConfig } from '../config/schema.js';
import {
  shouldConvertAgentsToSkills,
  shouldConvertCommandsToSkills,
} from '../config/conversions.js';
import { continueCommandRulePath } from '../targets/continue/command-rule.js';
import {
  CONTINUE_RULES_DIR,
  CONTINUE_ROOT_RULE,
  CONTINUE_SKILLS_DIR,
} from '../targets/continue/constants.js';
import {
  JUNIE_AGENTS_DIR,
  JUNIE_COMMANDS_DIR,
  JUNIE_RULES_DIR,
  JUNIE_SKILLS_DIR,
} from '../targets/junie/constants.js';
import { commandPromptPath } from '../targets/copilot/command-prompt.js';
import {
  COPILOT_AGENTS_DIR,
  COPILOT_INSTRUCTIONS_DIR,
  COPILOT_SKILLS_DIR,
} from '../targets/copilot/constants.js';
import { commandSkillDirName } from '../targets/codex-cli/command-skill.js';
import {
  AGENTS_MD,
  CODEX_AGENTS_DIR,
  CODEX_RULES_DIR,
  CODEX_SKILLS_DIR,
} from '../targets/codex-cli/constants.js';
import { codexAdvisoryInstructionPath } from '../targets/codex-cli/codex-rule-paths.js';
import {
  CLINE_AGENTS_MD,
  CLINE_RULES_DIR,
  CLINE_SKILLS_DIR,
  CLINE_WORKFLOWS_DIR,
} from '../targets/cline/constants.js';
import {
  GEMINI_AGENTS_DIR,
  GEMINI_COMMANDS_DIR,
  GEMINI_ROOT,
  GEMINI_SKILLS_DIR,
} from '../targets/gemini-cli/constants.js';
import { projectedAgentSkillDirName } from '../targets/projected-agent-skill.js';
import {
  WINDSURF_AGENTS_MD,
  WINDSURF_RULES_DIR,
  WINDSURF_SKILLS_DIR,
  WINDSURF_WORKFLOWS_DIR,
} from '../targets/windsurf/constants.js';

const ROOT_RULE_PATHS: Record<string, string> = {
  'claude-code': '.claude/CLAUDE.md',
  cursor: '.cursor/rules/general.mdc',
  copilot: '.github/copilot-instructions.md',
  continue: CONTINUE_ROOT_RULE,
  junie: '.junie/AGENTS.md',
  'gemini-cli': GEMINI_ROOT,
  cline: CLINE_AGENTS_MD,
  'codex-cli': AGENTS_MD,
  windsurf: WINDSURF_AGENTS_MD,
};

export const SKILL_DIRS: Record<string, string> = {
  'claude-code': '.claude/skills',
  cursor: '.cursor/skills',
  copilot: COPILOT_SKILLS_DIR,
  continue: CONTINUE_SKILLS_DIR,
  junie: JUNIE_SKILLS_DIR,
  'gemini-cli': GEMINI_SKILLS_DIR,
  cline: CLINE_SKILLS_DIR,
  'codex-cli': CODEX_SKILLS_DIR,
  windsurf: WINDSURF_SKILLS_DIR,
};

export function ruleTargetPath(
  target: string,
  rule: CanonicalFiles['rules'][number],
): string | null {
  if (rule.root) return ROOT_RULE_PATHS[target] ?? null;
  if (rule.targets.length > 0 && !rule.targets.includes(target)) return null;

  const slug = basename(rule.source, '.md');
  switch (target) {
    case 'claude-code':
      return `.claude/rules/${slug}.md`;
    case 'cursor':
      return `.cursor/rules/${slug}.mdc`;
    case 'copilot':
      return `${COPILOT_INSTRUCTIONS_DIR}/${slug}.instructions.md`;
    case 'continue':
      return `${CONTINUE_RULES_DIR}/${slug}.md`;
    case 'junie':
      return `${JUNIE_RULES_DIR}/${slug}.md`;
    case 'gemini-cli':
      // Non-root rules are embedded as sections in GEMINI.md, not separate files.
      // See docs/agent-structures/gemini-cli-project-level-advanced.md
      return GEMINI_ROOT;
    case 'cline':
      return `${CLINE_RULES_DIR}/${slug}.md`;
    case 'codex-cli':
      if (rule.codexEmit === 'execution') return `${CODEX_RULES_DIR}/${slug}.rules`;
      return codexAdvisoryInstructionPath(rule);
    case 'windsurf':
      return `${WINDSURF_RULES_DIR}/${slug}.md`;
    default:
      return null;
  }
}

export function commandTargetPath(
  target: string,
  name: string,
  config: ValidatedConfig,
): string | null {
  switch (target) {
    case 'claude-code':
      return `.claude/commands/${name}.md`;
    case 'cursor':
      return `.cursor/commands/${name}.md`;
    case 'copilot':
      return commandPromptPath(name);
    case 'continue':
      return continueCommandRulePath(name);
    case 'junie':
      return `${JUNIE_COMMANDS_DIR}/${name}.md`;
    case 'gemini-cli':
      if (name.includes(':')) {
        const parts = name.split(':').filter(Boolean);
        const fileBase = parts.pop() ?? name;
        const dirs = parts;
        return `${GEMINI_COMMANDS_DIR}/${dirs.join('/')}/${fileBase}.toml`;
      }
      return `${GEMINI_COMMANDS_DIR}/${name}.toml`;
    case 'cline':
      return `${CLINE_WORKFLOWS_DIR}/${name}.md`;
    case 'codex-cli':
      return shouldConvertCommandsToSkills(config, target)
        ? `${CODEX_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`
        : null;
    case 'windsurf':
      return `${WINDSURF_WORKFLOWS_DIR}/${name}.md`;
    default:
      return null;
  }
}

export function agentTargetPath(
  target: string,
  name: string,
  config: ValidatedConfig,
): string | null {
  switch (target) {
    case 'claude-code':
      return `.claude/agents/${name}.md`;
    case 'cursor':
      return `.cursor/agents/${name}.md`;
    case 'copilot':
      return `${COPILOT_AGENTS_DIR}/${name}.agent.md`;
    case 'junie':
      return `${JUNIE_AGENTS_DIR}/${name}.md`;
    case 'gemini-cli':
      return shouldConvertAgentsToSkills(config, target)
        ? `${SKILL_DIRS[target]}/${projectedAgentSkillDirName(name)}/SKILL.md`
        : `${GEMINI_AGENTS_DIR}/${name}.md`;
    case 'cline':
    case 'windsurf':
      return shouldConvertAgentsToSkills(config, target)
        ? `${SKILL_DIRS[target]}/${projectedAgentSkillDirName(name)}/SKILL.md`
        : null;
    case 'codex-cli':
      return `${CODEX_AGENTS_DIR}/${name}.toml`;
    default:
      return null;
  }
}
