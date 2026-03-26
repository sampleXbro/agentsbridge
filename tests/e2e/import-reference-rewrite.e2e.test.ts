import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { fileExists } from './helpers/assertions.js';
import { runCli } from './helpers/run-cli.js';

function assertPortable(content: string, targetPrefix: string): void {
  expect(content).not.toContain(targetPrefix);
  expect(content).not.toContain('.agentsmesh\\');
  expect(content).not.toContain('..\\');
}

function assertExternalRefs(content: string): void {
  expect(content).toContain('git@github.com:owner/repo.git');
  expect(content).toContain('ssh://git@github.com/owner/repo.git');
  expect(content).toContain('mailto:test@example.com');
  expect(content).toContain('vscode://file/path');
  expect(content).toContain('//cdn.example.com/lib.js');
}

function assertDocs(content: string): void {
  expect(content).toContain('docs/some-doc.md');
  expect(content).toContain('docs/agents-folder-structure-research.md');
  expect(content).not.toContain('../../../../docs/agents-folder-structure-research.md');
}

function appendReferenceVariants(dir: string): void {
  const absoluteCommand = join(dir, '.agentsmesh', 'commands', 'review.md');
  const absoluteSkillFile = join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md');
  const absoluteTemplate = join(dir, '.agentsmesh', 'skills', 'api-generator', 'template.ts');
  const absoluteReferencesDir = join(dir, '.agentsmesh', 'skills', 'api-generator', 'references');

  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'some-doc.md'), '# Some Doc\n');
  writeFileSync(join(dir, 'docs', 'agents-folder-structure-research.md'), '# Structure Research\n');

  writeFileSync(
    join(dir, '.agentsmesh', 'rules', '_root.md'),
    `${readFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), 'utf-8').trim()}\n\n## Link Matrix\nCanonical: .agentsmesh/rules/typescript.md, .agentsmesh/commands/review.md, .agentsmesh/agents/code-reviewer.md, .agentsmesh/skills/api-generator/SKILL.md, .agentsmesh/skills/api-generator/template.ts.\nMarkdown: [.agentsmesh/rules/typescript.md](.agentsmesh/rules/typescript.md), [.agentsmesh/skills/api-generator/references/route-checklist.md](.agentsmesh/skills/api-generator/references/route-checklist.md).\nStructured: @.agentsmesh/commands/review.md, \".agentsmesh/agents/code-reviewer.md\", (.agentsmesh/skills/api-generator/SKILL.md), <.agentsmesh/skills/api-generator/template.ts>.\nDirectories: .agentsmesh/skills/api-generator/references and .agentsmesh/skills/api-generator/references/.\nStatus markers: ✓ / ✗.\nExternal refs: git@github.com:owner/repo.git, ssh://git@github.com/owner/repo.git, mailto:test@example.com, vscode://file/path.\nWindows relative: ..\\commands\\review.md, ..\\skills\\api-generator\\SKILL.md, ..\\skills\\api-generator\\template.ts, ..\\..\\docs\\some-doc.md.\nMixed separators: .agentsmesh\\commands/review.md, .agentsmesh\\skills/api-generator\\template.ts.\nRelative: ./typescript.md, ../commands/review.md, ../skills/api-generator/SKILL.md, ../skills/api-generator/template.ts, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: ${absoluteCommand}, ${absoluteReferencesDir}\nLine ref: .agentsmesh/rules/typescript.md:42.\nProtocol-relative: //cdn.example.com/lib.js.\nInline code: \`../../docs/some-doc.md\`.\nCode block:\n\`\`\`\n../../docs/some-doc.md\n\`\`\`\nTilde block:\n~~~\n../../docs/some-doc.md\n~~~\n`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'commands', 'review.md'),
    `${readFileSync(join(dir, '.agentsmesh', 'commands', 'review.md'), 'utf-8').trim()}\n\nCanonical: .agentsmesh/skills/api-generator/template.ts.\nMarkdown: [.agentsmesh/skills/api-generator/template.ts](.agentsmesh/skills/api-generator/template.ts).\nStructured: @.agentsmesh/skills/api-generator/SKILL.md, \".agentsmesh/skills/api-generator/references/route-checklist.md\", (.agentsmesh/skills/api-generator/references/).\nStatus markers: ✓ / ✗.\nWindows relative: ..\\skills\\api-generator\\template.ts, ..\\..\\docs\\some-doc.md.\nMixed separators: .agentsmesh\\skills/api-generator\\template.ts.\nRelative: ../skills/api-generator/template.ts, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: ${absoluteTemplate}\n`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'agents', 'code-reviewer.md'),
    `${readFileSync(join(dir, '.agentsmesh', 'agents', 'code-reviewer.md'), 'utf-8').trim()}\n\nCanonical: .agentsmesh/commands/review.md.\nMarkdown: [.agentsmesh/commands/review.md](.agentsmesh/commands/review.md).\nStructured: @.agentsmesh/commands/review.md, \".agentsmesh/commands/review.md\", (.agentsmesh/commands/review.md).\nStatus markers: ✓ / ✗.\nWindows relative: ..\\commands\\review.md, ..\\..\\docs\\some-doc.md.\nMixed separators: .agentsmesh\\commands/review.md.\nRelative: ../commands/review.md, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: ${absoluteCommand}\n`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'),
    `${readFileSync(join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'), 'utf-8').trim()}\n\nCanonical: .agentsmesh/rules/typescript.md.\nMarkdown: [.agentsmesh/rules/typescript.md](.agentsmesh/rules/typescript.md).\nStructured: @.agentsmesh/rules/typescript.md, \".agentsmesh/skills/api-generator/references/\", (.agentsmesh/skills/api-generator/references/route-checklist.md).\nStatus markers: ✓ / ✗.\nWindows relative: .\\template.ts, ..\\..\\..\\docs\\some-doc.md.\nMixed separators: .agentsmesh\\rules/typescript.md, .agentsmesh\\skills/api-generator\\references/route-checklist.md.\nRelative: ./template.ts, ../../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: ${absoluteSkillFile}\n`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'skills', 'api-generator', 'template.ts'),
    `${readFileSync(join(dir, '.agentsmesh', 'skills', 'api-generator', 'template.ts'), 'utf-8').trim()}\n// Canonical: .agentsmesh/commands/review.md\n// Markdown: [.agentsmesh/commands/review.md](.agentsmesh/commands/review.md)\n// Structured: @.agentsmesh/commands/review.md, \".agentsmesh/skills/api-generator/references/route-checklist.md\", (.agentsmesh/skills/api-generator/references/)\n// Status markers: ✓ / ✗\n// Windows relative: .\\SKILL.md, ..\\..\\..\\docs\\some-doc.md\n// Mixed separators: .agentsmesh\\commands/review.md, .agentsmesh\\skills/api-generator\\references/route-checklist.md\n// Relative: ../SKILL.md, ../../../docs/some-doc.md\n// Overtravel: ../../../../docs/agents-folder-structure-research.md\n// Absolute: ${absoluteCommand}\n`,
  );
}

describe('import reference normalization', () => {
  let dir = '';
  const expectedRuleRef: Record<string, string> = {
    'claude-code': '.agentsmesh/rules/typescript.md',
    cursor: '.agentsmesh/rules/typescript.md',
    copilot: '.agentsmesh/rules/typescript.md',
    'gemini-cli': 'GEMINI.md',
    cline: '.agentsmesh/rules/typescript.md',
    'codex-cli': '.agentsmesh/rules/src.md',
    windsurf: '.agentsmesh/rules/typescript.md',
  };
  const expectedAgentCommandRef: Record<string, string> = {
    'claude-code': '.agentsmesh/commands/review.md',
    cursor: '.agentsmesh/commands/review.md',
    copilot: '.agentsmesh/commands/review.md',
    'gemini-cli': '.agentsmesh/commands/review.md',
    cline: '.agentsmesh/commands/review.md',
    'codex-cli': '.agentsmesh/commands/review.md',
    windsurf: '.agentsmesh/commands/review.md',
  };
  const targetPrefix: Record<string, string> = {
    'claude-code': '.claude/',
    cursor: '.cursor/',
    copilot: '.github/',
    'gemini-cli': '.gemini/',
    cline: '.cline/',
    'codex-cli': '.agents/',
    windsurf: '.windsurf/',
  };

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it.each(['claude-code', 'cursor', 'copilot', 'gemini-cli', 'cline', 'codex-cli', 'windsurf'])(
    'normalizes imported references for %s using the canonical-full fixture',
    async (target) => {
      dir = createTestProject('canonical-full');
      appendReferenceVariants(dir);

      const generateResult = await runCli(`generate --targets ${target}`, dir);
      expect(generateResult.exitCode, generateResult.stderr).toBe(0);

      rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });

      const importResult = await runCli(`import --from ${target}`, dir);
      expect(importResult.exitCode, importResult.stderr).toBe(0);

      const rootPath = join(dir, '.agentsmesh', 'rules', '_root.md');
      const commandPath = join(dir, '.agentsmesh', 'commands', 'review.md');
      const agentPath = join(dir, '.agentsmesh', 'agents', 'code-reviewer.md');
      const skillPath = join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md');
      const templatePath = join(dir, '.agentsmesh', 'skills', 'api-generator', 'template.ts');

      fileExists(rootPath);
      fileExists(commandPath);
      fileExists(agentPath);
      fileExists(skillPath);
      fileExists(templatePath);

      const rootContent = readFileSync(rootPath, 'utf-8');
      const commandContent = readFileSync(commandPath, 'utf-8');
      const agentContent = readFileSync(agentPath, 'utf-8');
      const skillContent = readFileSync(skillPath, 'utf-8');
      const templateContent = readFileSync(templatePath, 'utf-8');

      expect(rootContent).toContain(expectedRuleRef[target]);
      expect(rootContent).toContain('.agentsmesh/commands/review.md');
      expect(rootContent).toContain('.agentsmesh/agents/code-reviewer.md');
      expect(rootContent).toContain('.agentsmesh/skills/api-generator/SKILL.md');
      expect(rootContent).toContain('.agentsmesh/skills/api-generator/template.ts');
      expect(rootContent).toContain(`[${expectedRuleRef[target]}](${expectedRuleRef[target]})`);
      expect(rootContent).toContain(
        '[.agentsmesh/skills/api-generator/references/route-checklist.md](.agentsmesh/skills/api-generator/references/route-checklist.md)',
      );
      expect(rootContent).toContain('@.agentsmesh/commands/review.md');
      expect(rootContent).toContain('".agentsmesh/agents/code-reviewer.md"');
      expect(rootContent).toContain('(.agentsmesh/skills/api-generator/SKILL.md)');
      expect(rootContent).toContain('<.agentsmesh/skills/api-generator/template.ts>');
      expect(rootContent).toContain('.agentsmesh/skills/api-generator/references and');
      expect(rootContent).toContain('.agentsmesh/skills/api-generator/references/.');
      expect(rootContent).toContain('✓ / ✗');
      expect(rootContent).toContain(`${expectedRuleRef[target]}:42`);
      expect(rootContent).toContain('`docs/some-doc.md`');
      expect(rootContent).toContain('```\n../../docs/some-doc.md\n```');
      expect(rootContent).toContain('~~~\n../../docs/some-doc.md\n~~~');
      assertExternalRefs(rootContent);
      assertDocs(rootContent);
      expect(rootContent).not.toContain(join(dir, '.agentsmesh', 'commands', 'review.md'));
      expect(rootContent).not.toContain(
        join(dir, '.agentsmesh', 'skills', 'api-generator', 'references'),
      );
      assertPortable(rootContent, targetPrefix[target]);

      expect(commandContent).toContain('.agentsmesh/skills/api-generator/template.ts');
      expect(commandContent).toContain(
        '[.agentsmesh/skills/api-generator/template.ts](.agentsmesh/skills/api-generator/template.ts)',
      );
      expect(commandContent).toContain('@.agentsmesh/skills/api-generator/SKILL.md');
      expect(commandContent).toContain(
        '".agentsmesh/skills/api-generator/references/route-checklist.md"',
      );
      expect(commandContent).toContain('(.agentsmesh/skills/api-generator/references/)');
      expect(commandContent).toContain('✓ / ✗');
      assertDocs(commandContent);
      expect(commandContent).not.toContain(
        join(dir, '.agentsmesh', 'skills', 'api-generator', 'template.ts'),
      );
      assertPortable(commandContent, targetPrefix[target]);

      expect(agentContent).toContain(expectedAgentCommandRef[target]);
      expect(agentContent).toContain(
        `[${expectedAgentCommandRef[target]}](${expectedAgentCommandRef[target]})`,
      );
      expect(agentContent).toContain(`@${expectedAgentCommandRef[target]}`);
      expect(agentContent).toContain(`"${expectedAgentCommandRef[target]}"`);
      expect(agentContent).toContain(`(${expectedAgentCommandRef[target]})`);
      expect(agentContent).toContain('✓ / ✗');
      assertDocs(agentContent);
      expect(agentContent).not.toContain(join(dir, '.agentsmesh', 'commands', 'review.md'));
      assertPortable(agentContent, targetPrefix[target]);

      expect(skillContent).toContain(expectedRuleRef[target]);
      expect(skillContent).toContain(`[${expectedRuleRef[target]}](${expectedRuleRef[target]})`);
      expect(skillContent).toContain(`@${expectedRuleRef[target]}`);
      expect(skillContent).toContain('".agentsmesh/skills/api-generator/references/"');
      expect(skillContent).toContain(
        '(.agentsmesh/skills/api-generator/references/route-checklist.md)',
      );
      expect(skillContent).toContain('.agentsmesh/skills/api-generator/template.ts');
      expect(skillContent).toContain('✓ / ✗');
      assertDocs(skillContent);
      expect(skillContent).not.toContain(
        join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'),
      );
      assertPortable(skillContent, targetPrefix[target]);

      expect(templateContent).toContain('.agentsmesh/commands/review.md');
      expect(templateContent).toContain(
        '[.agentsmesh/commands/review.md](.agentsmesh/commands/review.md)',
      );
      expect(templateContent).toContain('@.agentsmesh/commands/review.md');
      expect(templateContent).toContain(
        '".agentsmesh/skills/api-generator/references/route-checklist.md"',
      );
      expect(templateContent).toContain('(.agentsmesh/skills/api-generator/references/)');
      expect(templateContent).toContain('✓ / ✗');
      expect(templateContent).toContain('../SKILL.md');
      assertDocs(templateContent);
      expect(templateContent).not.toContain(join(dir, '.agentsmesh', 'commands', 'review.md'));
      assertPortable(templateContent, targetPrefix[target]);
    },
  );
});
