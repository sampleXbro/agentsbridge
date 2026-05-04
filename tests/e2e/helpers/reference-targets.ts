import { commandSkillDirName } from '../../../src/targets/codex-cli/command-skill.js';
import { projectedAgentSkillDirName } from '../../../src/targets/projection/projected-agent-skill.js';

export type TargetName =
  | 'amp'
  | 'claude-code'
  | 'cursor'
  | 'copilot'
  | 'continue'
  | 'goose'
  | 'junie'
  | 'gemini-cli'
  | 'cline'
  | 'codex-cli'
  | 'windsurf'
  | 'antigravity'
  | 'roo-code'
  | 'kiro'
  | 'kilo-code'
  | 'opencode'
  | 'zed';

interface OutputPathGroups {
  root: string[];
  rule: string[];
  command: string[];
  agent: string[];
  skill: string[];
  template: string[];
}

function skillDir(target: TargetName): string {
  switch (target) {
    case 'claude-code':
      return '.claude/skills';
    case 'cursor':
      return '.cursor/skills';
    case 'copilot':
      return '.github/skills';
    case 'continue':
      return '.continue/skills';
    case 'junie':
      return '.junie/skills';
    case 'gemini-cli':
      return '.gemini/skills';
    case 'cline':
      return '.cline/skills';
    case 'amp':
      return '.agents/skills';
    case 'codex-cli':
      return '.agents/skills';
    case 'goose':
      return '.agents/skills';
    case 'windsurf':
      return '.windsurf/skills';
    case 'antigravity':
      return '.agents/skills';
    case 'roo-code':
      return '.roo/skills';
    case 'kiro':
      return '.kiro/skills';
    case 'kilo-code':
      return '.kilo/skills';
    case 'opencode':
      return '.opencode/skills';
    case 'zed':
      return '.zed/skills';
  }
}

export function outputPaths(target: TargetName): OutputPathGroups {
  const agentSkill =
    target === 'codex-cli'
      ? '.codex/agents/code-reviewer.toml'
      : `${skillDir(target)}/${projectedAgentSkillDirName('code-reviewer')}/SKILL.md`;

  return {
    root:
      target === 'claude-code'
        ? ['.claude/CLAUDE.md']
        : target === 'cursor'
          ? ['.cursor/rules/general.mdc']
          : target === 'copilot'
            ? ['.github/copilot-instructions.md']
            : target === 'continue'
              ? ['.continue/rules/general.md']
              : target === 'junie'
                ? ['.junie/AGENTS.md']
                : target === 'antigravity'
                  ? ['.agents/rules/general.md']
                  : target === 'roo-code'
                    ? ['.roo/rules/00-root.md']
                    : target === 'kilo-code'
                      ? ['AGENTS.md']
                      : target === 'goose'
                        ? ['.goosehints']
                        : target === 'zed'
                          ? ['.rules']
                          : ['AGENTS.md'],
    rule:
      target === 'copilot'
        ? ['.github/instructions/typescript.instructions.md']
        : target === 'continue'
          ? ['.continue/rules/typescript.md']
          : target === 'junie'
            ? ['.junie/rules/typescript.md']
            : target === 'windsurf'
              ? ['.windsurf/rules/typescript.md', 'src/AGENTS.md']
              : [
                  target === 'claude-code'
                    ? '.claude/rules/typescript.md'
                    : target === 'cursor'
                      ? '.cursor/rules/typescript.mdc'
                      : target === 'gemini-cli'
                        ? 'GEMINI.md'
                        : target === 'cline'
                          ? '.clinerules/typescript.md'
                          : target === 'codex-cli'
                            ? '.codex/instructions/typescript.md'
                            : target === 'kiro'
                              ? '.kiro/steering/typescript.md'
                              : target === 'antigravity'
                                ? '.agents/rules/typescript.md'
                                : target === 'roo-code'
                                  ? '.roo/rules/typescript.md'
                                  : target === 'kilo-code'
                                    ? '.kilo/rules/typescript.md'
                                    : target === 'opencode'
                                      ? '.opencode/rules/typescript.md'
                                      : 'src/AGENTS.md',
                ],
    command: [
      target === 'claude-code'
        ? '.claude/commands/review.md'
        : target === 'cursor'
          ? '.cursor/commands/review.md'
          : target === 'copilot'
            ? '.github/prompts/review.prompt.md'
            : target === 'continue'
              ? '.continue/prompts/review.md'
              : target === 'junie'
                ? '.junie/commands/review.md'
                : target === 'kiro'
                  ? '.kiro/steering/typescript.md'
                  : target === 'gemini-cli'
                    ? '.gemini/commands/review.toml'
                    : target === 'cline'
                      ? '.clinerules/workflows/review.md'
                      : target === 'windsurf'
                        ? '.windsurf/workflows/review.md'
                        : target === 'antigravity'
                          ? '.agents/workflows/review.md'
                          : target === 'roo-code'
                            ? '.roo/commands/review.md'
                            : target === 'kilo-code'
                              ? '.kilo/commands/review.md'
                              : target === 'opencode'
                                ? '.opencode/commands/review.md'
                                : `${skillDir(target)}/${commandSkillDirName('review')}/SKILL.md`,
    ],
    agent: [
      target === 'claude-code'
        ? '.claude/agents/code-reviewer.md'
        : target === 'cursor'
          ? '.cursor/agents/code-reviewer.md'
          : target === 'copilot'
            ? '.github/agents/code-reviewer.agent.md'
            : target === 'junie'
              ? '.junie/agents/code-reviewer.md'
              : target === 'kiro'
                ? '.kiro/agents/code-reviewer.md'
                : target === 'gemini-cli'
                  ? '.gemini/agents/code-reviewer.md'
                  : target === 'kilo-code'
                    ? '.kilo/agents/code-reviewer.md'
                    : target === 'opencode'
                      ? '.opencode/agents/code-reviewer.md'
                      : agentSkill,
    ],
    skill: [`${skillDir(target)}/api-generator/SKILL.md`],
    template: [`${skillDir(target)}/api-generator/template.ts`],
  };
}

export function expectedRefs(target: TargetName, path?: string): Record<string, string> {
  const skills = skillDir(target);
  const geminiCompatSkills =
    path === 'AGENTS.md' && target === 'gemini-cli' ? '.agents/skills' : skills;
  let rootRule =
    target === 'gemini-cli'
      ? 'GEMINI.md'
      : target === 'claude-code'
        ? '.claude/CLAUDE.md'
        : target === 'cursor'
          ? '.cursor/rules/general.mdc'
          : target === 'copilot'
            ? '.github/copilot-instructions.md'
            : target === 'continue'
              ? '.continue/rules/general.md'
              : target === 'junie'
                ? '.junie/AGENTS.md'
                : target === 'kiro'
                  ? 'AGENTS.md'
                  : target === 'antigravity'
                    ? '.agents/rules/general.md'
                    : target === 'roo-code'
                      ? '.roo/rules/00-root.md'
                      : target === 'kilo-code'
                        ? 'AGENTS.md'
                        : target === 'zed'
                          ? '.rules'
                          : 'AGENTS.md';
  // From `src/AGENTS.md`, the rewriter points at repo-root AGENTS as `../AGENTS.md`.
  if (target === 'windsurf' && path === 'src/AGENTS.md') {
    rootRule = '../AGENTS.md';
  }
  const rule =
    target === 'continue'
      ? '.continue/rules/typescript.md'
      : target === 'junie'
        ? '.junie/rules/typescript.md'
        : target === 'kiro'
          ? '.kiro/steering/typescript.md'
          : target === 'gemini-cli'
            ? 'GEMINI.md'
            : target === 'cline'
              ? '.clinerules/typescript.md'
              : target === 'codex-cli'
                ? '.codex/instructions/typescript.md'
                : target === 'windsurf'
                  ? '.windsurf/rules/typescript.md'
                  : target === 'antigravity'
                    ? '.agents/rules/typescript.md'
                    : target === 'roo-code'
                      ? '.roo/rules/typescript.md'
                      : target === 'copilot'
                        ? '.github/instructions/typescript.instructions.md'
                        : target === 'cursor'
                          ? '.cursor/rules/typescript.mdc'
                          : target === 'kilo-code'
                            ? '.kilo/rules/typescript.md'
                            : target === 'opencode'
                              ? '.opencode/rules/typescript.md'
                              : '.claude/rules/typescript.md';
  const checklist = `${geminiCompatSkills}/api-generator/references/route-checklist.md`;
  return {
    rootRule,
    rule,
    command:
      target === 'claude-code'
        ? '.claude/commands/review.md'
        : target === 'cursor'
          ? '.cursor/commands/review.md'
          : target === 'copilot'
            ? '.github/prompts/review.prompt.md'
            : target === 'continue'
              ? '.continue/prompts/review.md'
              : target === 'junie'
                ? '.junie/commands/review.md'
                : target === 'kiro'
                  ? '.kiro/steering/typescript.md'
                  : target === 'gemini-cli'
                    ? '.gemini/commands/review.toml'
                    : target === 'cline'
                      ? '.clinerules/workflows/review.md'
                      : target === 'codex-cli'
                        ? `.agents/skills/${commandSkillDirName('review')}/SKILL.md`
                        : target === 'antigravity'
                          ? '.agents/workflows/review.md'
                          : target === 'roo-code'
                            ? '.roo/commands/review.md'
                            : target === 'kilo-code'
                              ? '.kilo/commands/review.md'
                              : target === 'opencode'
                                ? '.opencode/commands/review.md'
                                : '.windsurf/workflows/review.md',
    agent:
      target === 'claude-code'
        ? '.claude/agents/code-reviewer.md'
        : target === 'cursor'
          ? '.cursor/agents/code-reviewer.md'
          : target === 'copilot'
            ? '.github/agents/code-reviewer.agent.md'
            : target === 'junie'
              ? '.junie/agents/code-reviewer.md'
              : target === 'kiro'
                ? '.kiro/agents/code-reviewer.md'
                : target === 'gemini-cli'
                  ? '.gemini/agents/code-reviewer.md'
                  : target === 'codex-cli'
                    ? '.codex/agents/code-reviewer.toml'
                    : target === 'kilo-code'
                      ? '.kilo/agents/code-reviewer.md'
                      : target === 'opencode'
                        ? '.opencode/agents/code-reviewer.md'
                        : `${skills}/${projectedAgentSkillDirName('code-reviewer')}/SKILL.md`,
    skill: `${geminiCompatSkills}/api-generator/SKILL.md`,
    template: `${geminiCompatSkills}/api-generator/template.ts`,
    checklist,
    referencesDir: `${geminiCompatSkills}/api-generator/references`,
    doc: 'docs/some-doc.md',
    researchDoc: 'docs/agents-folder-structure-research.md',
  };
}
