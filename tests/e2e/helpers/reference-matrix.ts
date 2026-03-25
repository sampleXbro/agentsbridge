import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { commandSkillDirName } from '../../../src/targets/codex-cli/command-skill.js';
import { projectedAgentSkillDirName } from '../../../src/targets/projected-agent-skill.js';

export type TargetName =
  | 'claude-code'
  | 'cursor'
  | 'copilot'
  | 'junie'
  | 'gemini-cli'
  | 'cline'
  | 'codex-cli'
  | 'windsurf';

export function appendGenerateReferenceMatrix(dir: string): void {
  const abs = (...parts: string[]) => join(dir, ...parts);
  mkdirSync(abs('docs'), { recursive: true });
  writeFileSync(abs('docs', 'some-doc.md'), '# Some Doc\n');
  writeFileSync(abs('docs', 'agents-folder-structure-research.md'), '# Structure Research\n');

  writeFileSync(
    abs('.agentsbridge', 'rules', '_root.md'),
    `${readFileSync(abs('.agentsbridge', 'rules', '_root.md'), 'utf-8').trim()}\n\n## Rewrite Matrix\nPlain: .agentsbridge/rules/typescript.md, .agentsbridge/commands/review.md, .agentsbridge/agents/code-reviewer.md, .agentsbridge/skills/api-generator/SKILL.md, .agentsbridge/skills/api-generator/template.ts, .agentsbridge/skills/api-generator/references/route-checklist.md.\nMarkdown: [.agentsbridge/rules/typescript.md](.agentsbridge/rules/typescript.md), [.agentsbridge/skills/api-generator/references/route-checklist.md](.agentsbridge/skills/api-generator/references/route-checklist.md).\nStructured: @.agentsbridge/commands/review.md, ".agentsbridge/agents/code-reviewer.md", (.agentsbridge/skills/api-generator/SKILL.md), <.agentsbridge/skills/api-generator/template.ts>.\nDirectories: .agentsbridge/skills/api-generator/references and .agentsbridge/skills/api-generator/references/.\nStatus markers: ✓ / ✗.\nExternal refs: git@github.com:owner/repo.git, ssh://git@github.com/owner/repo.git, mailto:test@example.com, vscode://file/path.\nWindows relative: ..\\commands\\review.md, ..\\agents\\code-reviewer.md, ..\\skills\\api-generator\\SKILL.md, ..\\skills\\api-generator\\template.ts, ..\\skills\\api-generator\\references\\route-checklist.md, ..\\..\\docs\\some-doc.md.\nMixed separators: .agentsbridge\\commands/review.md, .agentsbridge\\skills/api-generator\\references/route-checklist.md.\nRelative: ./typescript.md, ../commands/review.md, ../agents/code-reviewer.md, ../skills/api-generator/SKILL.md, ../skills/api-generator/template.ts, ../skills/api-generator/references/route-checklist.md, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: ${abs('.agentsbridge', 'rules', 'typescript.md')}, ${abs('.agentsbridge', 'commands', 'review.md')}, ${abs('.agentsbridge', 'skills', 'api-generator', 'references', 'route-checklist.md')}\nLine ref: .agentsbridge/rules/typescript.md:42.\nProtocol-relative: //cdn.example.com/lib.js.\nInline code: \`../../docs/some-doc.md\`.\nCode block:\n\`\`\`\n../../docs/some-doc.md\n\`\`\`\nTilde block:\n~~~\n../../docs/some-doc.md\n~~~\n`,
  );
  writeFileSync(
    abs('.agentsbridge', 'rules', 'typescript.md'),
    `${readFileSync(abs('.agentsbridge', 'rules', 'typescript.md'), 'utf-8').trim()}\n\n## Rewrite Matrix\nPlain: .agentsbridge/rules/_root.md, .agentsbridge/commands/review.md, .agentsbridge/agents/code-reviewer.md, .agentsbridge/skills/api-generator/SKILL.md, .agentsbridge/skills/api-generator/template.ts, .agentsbridge/skills/api-generator/references/route-checklist.md.\nMarkdown: [.agentsbridge/rules/_root.md](.agentsbridge/rules/_root.md), [.agentsbridge/commands/review.md](.agentsbridge/commands/review.md).\nStructured: @.agentsbridge/agents/code-reviewer.md, ".agentsbridge/skills/api-generator/SKILL.md", (.agentsbridge/skills/api-generator/references/route-checklist.md), <.agentsbridge/skills/api-generator/template.ts>.\nDirectories: .agentsbridge/skills/api-generator/references and .agentsbridge/skills/api-generator/references/.\nStatus markers: ✓ / ✗.\nWindows relative: ..\\commands\\review.md, ..\\agents\\code-reviewer.md, ..\\skills\\api-generator\\SKILL.md, ..\\skills\\api-generator\\template.ts, ..\\skills\\api-generator\\references\\route-checklist.md, ..\\..\\docs\\some-doc.md.\nMixed separators: .agentsbridge\\commands/review.md, .agentsbridge\\skills/api-generator\\references/route-checklist.md.\nRelative: ./_root.md, ../commands/review.md, ../agents/code-reviewer.md, ../skills/api-generator/SKILL.md, ../skills/api-generator/template.ts, ../skills/api-generator/references/route-checklist.md, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: ${abs('.agentsbridge', 'rules', '_root.md')}, ${abs('.agentsbridge', 'commands', 'review.md')}, ${abs('.agentsbridge', 'skills', 'api-generator', 'references', 'route-checklist.md')}\n`,
  );
  writeFileSync(
    abs('.agentsbridge', 'commands', 'review.md'),
    `${readFileSync(abs('.agentsbridge', 'commands', 'review.md'), 'utf-8').trim()}\n\nPlain: .agentsbridge/rules/typescript.md, .agentsbridge/rules/_root.md, .agentsbridge/skills/api-generator/SKILL.md, .agentsbridge/skills/api-generator/template.ts, .agentsbridge/skills/api-generator/references/route-checklist.md.\nMarkdown: [.agentsbridge/rules/typescript.md](.agentsbridge/rules/typescript.md), [.agentsbridge/skills/api-generator/template.ts](.agentsbridge/skills/api-generator/template.ts).\nStructured: @.agentsbridge/rules/_root.md, ".agentsbridge/skills/api-generator/SKILL.md", (.agentsbridge/skills/api-generator/references/route-checklist.md), <.agentsbridge/skills/api-generator/template.ts>.\nDirectories: .agentsbridge/skills/api-generator/references and .agentsbridge/skills/api-generator/references/.\nStatus markers: ✓ / ✗.\nWindows relative: ..\\rules\\typescript.md, ..\\rules\\_root.md, ..\\skills\\api-generator\\SKILL.md, ..\\skills\\api-generator\\template.ts, ..\\skills\\api-generator\\references\\route-checklist.md, ..\\..\\docs\\some-doc.md.\nMixed separators: .agentsbridge\\rules/typescript.md, .agentsbridge\\skills/api-generator\\template.ts.\nRelative: ../rules/typescript.md, ../rules/_root.md, ../skills/api-generator/SKILL.md, ../skills/api-generator/template.ts, ../skills/api-generator/references/route-checklist.md, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: ${abs('.agentsbridge', 'rules', 'typescript.md')}, ${abs('.agentsbridge', 'skills', 'api-generator', 'template.ts')}\n`,
  );
  writeFileSync(
    abs('.agentsbridge', 'agents', 'code-reviewer.md'),
    `${readFileSync(abs('.agentsbridge', 'agents', 'code-reviewer.md'), 'utf-8').trim()}\n\nPlain: .agentsbridge/commands/review.md, .agentsbridge/rules/typescript.md, .agentsbridge/skills/api-generator/SKILL.md, .agentsbridge/skills/api-generator/template.ts.\nMarkdown: [.agentsbridge/commands/review.md](.agentsbridge/commands/review.md), [.agentsbridge/rules/typescript.md](.agentsbridge/rules/typescript.md).\nStructured: @.agentsbridge/commands/review.md, ".agentsbridge/skills/api-generator/SKILL.md", (.agentsbridge/skills/api-generator/template.ts), <.agentsbridge/skills/api-generator/references/route-checklist.md>.\nStatus markers: ✓ / ✗.\nWindows relative: ..\\commands\\review.md, ..\\rules\\typescript.md, ..\\skills\\api-generator\\SKILL.md, ..\\skills\\api-generator\\template.ts, ..\\skills\\api-generator\\references\\route-checklist.md, ..\\..\\docs\\some-doc.md.\nMixed separators: .agentsbridge\\commands/review.md, .agentsbridge\\skills/api-generator\\template.ts.\nRelative: ../commands/review.md, ../rules/typescript.md, ../skills/api-generator/SKILL.md, ../skills/api-generator/template.ts, ../skills/api-generator/references/route-checklist.md, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: ${abs('.agentsbridge', 'commands', 'review.md')}, ${abs('.agentsbridge', 'skills', 'api-generator', 'template.ts')}\n`,
  );
  writeFileSync(
    abs('.agentsbridge', 'skills', 'api-generator', 'SKILL.md'),
    `${readFileSync(abs('.agentsbridge', 'skills', 'api-generator', 'SKILL.md'), 'utf-8').trim()}\n\nPlain: .agentsbridge/rules/typescript.md, .agentsbridge/rules/_root.md, .agentsbridge/commands/review.md, .agentsbridge/agents/code-reviewer.md, .agentsbridge/skills/api-generator/template.ts, .agentsbridge/skills/api-generator/references/route-checklist.md.\nMarkdown: [.agentsbridge/rules/typescript.md](.agentsbridge/rules/typescript.md), [.agentsbridge/commands/review.md](.agentsbridge/commands/review.md).\nStructured: @.agentsbridge/rules/_root.md, ".agentsbridge/agents/code-reviewer.md", (.agentsbridge/skills/api-generator/references/route-checklist.md), <.agentsbridge/skills/api-generator/template.ts>.\nDirectories: .agentsbridge/skills/api-generator/references and .agentsbridge/skills/api-generator/references/.\nStatus markers: ✓ / ✗.\nWindows relative: ..\\..\\rules\\typescript.md, ..\\..\\rules\\_root.md, ..\\..\\commands\\review.md, ..\\..\\agents\\code-reviewer.md, template.ts, references\\route-checklist.md, ..\\..\\..\\docs\\some-doc.md.\nMixed separators: .agentsbridge\\rules/typescript.md, .agentsbridge\\skills/api-generator\\references/route-checklist.md.\nRelative: ../../rules/typescript.md, ../../rules/_root.md, ../../commands/review.md, ../../agents/code-reviewer.md, template.ts, references/route-checklist.md, ../../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: ${abs('.agentsbridge', 'rules', 'typescript.md')}, ${abs('.agentsbridge', 'commands', 'review.md')}, ${abs('.agentsbridge', 'skills', 'api-generator', 'references', 'route-checklist.md')}\n`,
  );
  writeFileSync(
    abs('.agentsbridge', 'skills', 'api-generator', 'template.ts'),
    `${readFileSync(abs('.agentsbridge', 'skills', 'api-generator', 'template.ts'), 'utf-8').trim()}\n// Plain: .agentsbridge/rules/typescript.md, .agentsbridge/commands/review.md, .agentsbridge/agents/code-reviewer.md, .agentsbridge/skills/api-generator/SKILL.md, .agentsbridge/skills/api-generator/references/route-checklist.md\n// Markdown: [.agentsbridge/commands/review.md](.agentsbridge/commands/review.md), [.agentsbridge/skills/api-generator/references/route-checklist.md](.agentsbridge/skills/api-generator/references/route-checklist.md)\n// Structured: @.agentsbridge/rules/_root.md, ".agentsbridge/commands/review.md", (SKILL.md), <references/route-checklist.md>\n// Directories: references and references/\n// Status markers: ✓ / ✗\n// Windows relative: ..\\..\\rules\\typescript.md, ..\\..\\commands\\review.md, ..\\..\\agents\\code-reviewer.md, SKILL.md, references\\route-checklist.md, ..\\..\\..\\docs\\some-doc.md\n// Mixed separators: .agentsbridge\\commands/review.md, .agentsbridge\\skills/api-generator\\references/route-checklist.md\n// Relative: ../../rules/typescript.md, ../../commands/review.md, ../../agents/code-reviewer.md, SKILL.md, references/route-checklist.md, ../../../docs/some-doc.md\n// Overtravel: ../../../../docs/agents-folder-structure-research.md\n// Absolute: ${abs('.agentsbridge', 'rules', 'typescript.md')}, ${abs('.agentsbridge', 'commands', 'review.md')}, ${abs('.agentsbridge', 'skills', 'api-generator', 'SKILL.md')}, ${abs('.agentsbridge', 'skills', 'api-generator', 'references', 'route-checklist.md')}\n`,
  );
}

function skillDir(target: TargetName): string {
  switch (target) {
    case 'claude-code':
      return '.claude/skills';
    case 'cursor':
      return '.cursor/skills';
    case 'copilot':
      return '.github/skills';
    case 'junie':
      return '.junie/skills';
    case 'gemini-cli':
      return '.gemini/skills';
    case 'cline':
      return '.cline/skills';
    case 'codex-cli':
      return '.agents/skills';
    case 'windsurf':
      return '.windsurf/skills';
  }
}

export function outputPaths(target: TargetName): Record<string, string[]> {
  const commandSkill = `${skillDir('codex-cli')}/${commandSkillDirName('review')}/SKILL.md`;
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
            : target === 'junie'
              ? ['.junie/AGENTS.md']
              : target === 'gemini-cli'
                ? ['GEMINI.md']
                : target === 'cline'
                  ? ['AGENTS.md']
                  : ['AGENTS.md'],
    rule:
      target === 'copilot'
        ? ['.github/instructions/typescript.instructions.md']
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
                          ? 'src/AGENTS.md'
                          : 'src/AGENTS.md',
              ],
    command: [
      target === 'claude-code'
        ? '.claude/commands/review.md'
        : target === 'cursor'
          ? '.cursor/commands/review.md'
          : target === 'copilot'
            ? '.github/prompts/review.prompt.md'
            : target === 'junie'
              ? '.junie/commands/review.md'
              : target === 'gemini-cli'
                ? '.gemini/commands/review.toml'
                : target === 'cline'
                  ? '.clinerules/workflows/review.md'
                  : target === 'windsurf'
                    ? '.windsurf/workflows/review.md'
                    : commandSkill,
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
              : target === 'gemini-cli'
                ? '.gemini/agents/code-reviewer.md'
                : agentSkill,
    ],
    skill: [`${skillDir(target)}/api-generator/SKILL.md`],
    template: [`${skillDir(target)}/api-generator/template.ts`],
  };
}

export function expectedRefs(target: TargetName, outputPath: string): Record<string, string> {
  const skills = skillDir(target);
  return {
    rootRule:
      target === 'claude-code'
        ? '.claude/CLAUDE.md'
        : target === 'cursor'
          ? '.cursor/rules/general.mdc'
          : target === 'copilot'
            ? '.github/copilot-instructions.md'
            : target === 'junie'
              ? '.junie/AGENTS.md'
              : target === 'gemini-cli'
                ? 'GEMINI.md'
                : target === 'cline'
                  ? 'AGENTS.md'
                  : target === 'codex-cli'
                    ? 'AGENTS.md'
                    : 'AGENTS.md',
    rule:
      target === 'claude-code'
        ? '.claude/rules/typescript.md'
        : target === 'cursor'
          ? '.cursor/rules/typescript.mdc'
          : target === 'copilot'
            ? '.github/instructions/typescript.instructions.md'
            : target === 'junie'
              ? '.junie/rules/typescript.md'
              : target === 'gemini-cli'
                ? 'GEMINI.md'
                : target === 'cline'
                  ? '.clinerules/typescript.md'
                  : target === 'codex-cli'
                    ? 'src/AGENTS.md'
                    : '.windsurf/rules/typescript.md',
    command:
      target === 'claude-code'
        ? '.claude/commands/review.md'
        : target === 'cursor'
          ? '.cursor/commands/review.md'
          : target === 'copilot'
            ? '.github/prompts/review.prompt.md'
            : target === 'junie'
              ? '.junie/commands/review.md'
              : target === 'gemini-cli'
                ? '.gemini/commands/review.toml'
                : target === 'cline'
                  ? '.clinerules/workflows/review.md'
                  : target === 'codex-cli'
                    ? `.agents/skills/${commandSkillDirName('review')}/SKILL.md`
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
              : target === 'gemini-cli'
                ? '.gemini/agents/code-reviewer.md'
                : target === 'codex-cli'
                  ? '.codex/agents/code-reviewer.toml'
                  : `${skills}/${projectedAgentSkillDirName('code-reviewer')}/SKILL.md`,
    skill: `${skills}/api-generator/SKILL.md`,
    template: `${skills}/api-generator/template.ts`,
    checklist: `${skills}/api-generator/references/route-checklist.md`,
    referencesDir: `${skills}/api-generator/references`,
    researchDoc: 'docs/agents-folder-structure-research.md',
    doc: 'docs/some-doc.md',
  };
}
