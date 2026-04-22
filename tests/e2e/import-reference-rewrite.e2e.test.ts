import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { fileExists } from './helpers/assertions.js';
import { runCli } from './helpers/run-cli.js';
import type { TargetName } from './helpers/reference-targets.js';

type RewriteTarget = Exclude<TargetName, 'continue' | 'junie'>;

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
}

function appendReferenceVariants(dir: string): void {
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'some-doc.md'), '# Some Doc\n');
  writeFileSync(join(dir, 'docs', 'agents-folder-structure-research.md'), '# Structure Research\n');

  writeFileSync(
    join(dir, '.agentsmesh', 'rules', '_root.md'),
    `${readFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), 'utf-8').trim()}\n\n## Link Matrix\nCanonical: .agentsmesh/rules/typescript.md, .agentsmesh/commands/review.md, .agentsmesh/agents/code-reviewer.md, .agentsmesh/skills/api-generator/SKILL.md, .agentsmesh/skills/api-generator/template.ts.\nMarkdown: [.agentsmesh/rules/typescript.md](.agentsmesh/rules/typescript.md), [.agentsmesh/skills/api-generator/references/route-checklist.md](.agentsmesh/skills/api-generator/references/route-checklist.md).\nStructured: @.agentsmesh/commands/review.md, ".agentsmesh/agents/code-reviewer.md", (.agentsmesh/skills/api-generator/SKILL.md), <.agentsmesh/skills/api-generator/template.ts>.\nDirectories: .agentsmesh/skills/api-generator/references and .agentsmesh/skills/api-generator/references/.\nStatus markers: ✓ / ✗.\nExternal refs: git@github.com:owner/repo.git, ssh://git@github.com/owner/repo.git, mailto:test@example.com, vscode://file/path.\nWindows relative: ../commands/review.md, ../skills/api-generator/SKILL.md, ../skills/api-generator/template.ts, ../../docs/some-doc.md.\nMixed separators: .agentsmesh/commands/review.md, .agentsmesh/skills/api-generator/template.ts.\nRelative: ./typescript.md, ../commands/review.md, ../skills/api-generator/SKILL.md, ../skills/api-generator/template.ts, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: .agentsmesh/commands/review.md, .agentsmesh/skills/api-generator/references\nLine ref: .agentsmesh/rules/typescript.md:42.\nProtocol-relative: //cdn.example.com/lib.js.\nInline code: \`../../docs/some-doc.md\`.\nCode block:\n\`\`\`\n../../docs/some-doc.md\n\`\`\`\nTilde block:\n~~~\n../../docs/some-doc.md\n~~~\n`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'commands', 'review.md'),
    `${readFileSync(join(dir, '.agentsmesh', 'commands', 'review.md'), 'utf-8').trim()}\n\nCanonical: .agentsmesh/skills/api-generator/template.ts.\nMarkdown: [.agentsmesh/skills/api-generator/template.ts](.agentsmesh/skills/api-generator/template.ts).\nStructured: @.agentsmesh/skills/api-generator/SKILL.md, ".agentsmesh/skills/api-generator/references/route-checklist.md", (.agentsmesh/skills/api-generator/references/).\nStatus markers: ✓ / ✗.\nWindows relative: ../skills/api-generator/template.ts, ../../docs/some-doc.md.\nMixed separators: .agentsmesh/skills/api-generator/template.ts.\nRelative: ../skills/api-generator/template.ts, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: .agentsmesh/skills/api-generator/template.ts\n`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'agents', 'code-reviewer.md'),
    `${readFileSync(join(dir, '.agentsmesh', 'agents', 'code-reviewer.md'), 'utf-8').trim()}\n\nCanonical: .agentsmesh/commands/review.md.\nMarkdown: [.agentsmesh/commands/review.md](.agentsmesh/commands/review.md).\nStructured: @.agentsmesh/commands/review.md, ".agentsmesh/commands/review.md", (.agentsmesh/commands/review.md).\nStatus markers: ✓ / ✗.\nWindows relative: ../commands/review.md, ../../docs/some-doc.md.\nMixed separators: .agentsmesh/commands/review.md.\nRelative: ../commands/review.md, ../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: .agentsmesh/commands/review.md\n`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'),
    `${readFileSync(join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'), 'utf-8').trim()}\n\nCanonical: .agentsmesh/rules/typescript.md.\nMarkdown: [.agentsmesh/rules/typescript.md](.agentsmesh/rules/typescript.md).\nStructured: @.agentsmesh/rules/typescript.md, ".agentsmesh/skills/api-generator/references/", (.agentsmesh/skills/api-generator/references/route-checklist.md).\nStatus markers: ✓ / ✗.\nWindows relative: ./template.ts, ../../../docs/some-doc.md.\nMixed separators: .agentsmesh/rules/typescript.md, .agentsmesh/skills/api-generator/references/route-checklist.md.\nRelative: ./template.ts, ../../../docs/some-doc.md.\nOvertravel: ../../../../docs/agents-folder-structure-research.md.\nAbsolute: .agentsmesh/skills/api-generator/SKILL.md\n`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'skills', 'api-generator', 'template.ts'),
    `${readFileSync(join(dir, '.agentsmesh', 'skills', 'api-generator', 'template.ts'), 'utf-8').trim()}\n// Canonical: .agentsmesh/commands/review.md\n// Markdown: [.agentsmesh/commands/review.md](.agentsmesh/commands/review.md)\n// Structured: @.agentsmesh/commands/review.md, ".agentsmesh/skills/api-generator/references/route-checklist.md", (.agentsmesh/skills/api-generator/references/)\n// Status markers: ✓ / ✗\n// Windows relative: ./SKILL.md, ../../../docs/some-doc.md\n// Mixed separators: .agentsmesh/commands/review.md, .agentsmesh/skills/api-generator/references/route-checklist.md\n// Relative: ../SKILL.md, ../../../docs/some-doc.md\n// Overtravel: ../../../../docs/agents-folder-structure-research.md\n// Absolute: .agentsmesh/commands/review.md\n`,
  );
}

function ruleLinkInRoot(target: RewriteTarget): string {
  return target === 'gemini-cli' ? 'GEMINI.md' : 'typescript.md';
}

describe('import reference normalization', () => {
  let dir = '';
  const targetPrefix: Record<RewriteTarget, string> = {
    'claude-code': '.claude/',
    cursor: '.cursor/',
    copilot: '.github/',
    'gemini-cli': '.gemini/',
    cline: '.cline/',
    'codex-cli': '.agents/',
    windsurf: '.windsurf/',
  };
  const TARGETS = [
    'claude-code',
    'cursor',
    'copilot',
    'gemini-cli',
    'cline',
    'codex-cli',
    'windsurf',
  ] as const satisfies readonly RewriteTarget[];

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it.each(TARGETS)(
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

      const ruleName = ruleLinkInRoot(target);
      // Gemini folds non-root rules into GEMINI.md, so imports cannot restore a separate
      // `.agentsmesh/rules/typescript.md` file from the root context alone.
      const mdSelfName = ruleName;
      const escapedRule = mdSelfName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ruleMdSelf =
        target === 'gemini-cli'
          ? /\[(?:\.agentsmesh\/rules\/typescript\.md|(?:\.\/)?(?:typescript\.md|GEMINI\.md))\]\((?:\.\/)?GEMINI\.md\)/
          : new RegExp(
              `\\[(?:\\.agentsmesh/rules/typescript\\.md|(?:\\./)?${escapedRule})\\]\\((?:\\./)?${escapedRule}\\)`,
            );
      expect(rootContent).toContain(mdSelfName);
      expect(rootContent).toContain('.agentsmesh/commands/review.md');
      expect(rootContent).toContain('.agentsmesh/agents/code-reviewer.md');
      expect(
        rootContent.includes('.agentsmesh/skills/api-generator/SKILL.md') ||
          rootContent.includes('../skills/api-generator/SKILL.md'),
      ).toBe(true);
      expect(
        rootContent.includes('.agentsmesh/skills/api-generator/template.ts') ||
          rootContent.includes('../skills/api-generator/template.ts'),
      ).toBe(true);
      expect(rootContent).toMatch(ruleMdSelf);
      expect(
        rootContent.includes(
          '[.agentsmesh/skills/api-generator/references/route-checklist.md](../skills/api-generator/references/route-checklist.md)',
        ) ||
          rootContent.includes(
            '[../skills/api-generator/references/route-checklist.md](../skills/api-generator/references/route-checklist.md)',
          ),
      ).toBe(true);
      expect(
        rootContent.includes('@.agentsmesh/commands/review.md') ||
          rootContent.includes('@../commands/review.md') ||
          rootContent.includes('@./commands/review.md') ||
          rootContent.includes('@./prompts/review.prompt.md') ||
          rootContent.includes('@../prompts/review.prompt.md'),
      ).toBe(true);
      expect(rootContent).toContain('".agentsmesh/agents/code-reviewer.md"');
      expect(
        rootContent.includes('(../skills/api-generator/SKILL.md)') ||
          rootContent.includes('(./skills/api-generator/SKILL.md)') ||
          rootContent.includes('(.agentsmesh/skills/api-generator/SKILL.md)') ||
          rootContent.includes('(skills/api-generator/SKILL.md)'),
      ).toBe(true);
      expect(
        rootContent.includes('<../skills/api-generator/template.ts>') ||
          rootContent.includes('<./skills/api-generator/template.ts>') ||
          rootContent.includes('<.agentsmesh/skills/api-generator/template.ts>') ||
          rootContent.includes('<skills/api-generator/template.ts>'),
      ).toBe(true);
      expect(
        rootContent.includes('../skills/api-generator/references and') ||
          rootContent.includes('./skills/api-generator/references and') ||
          rootContent.includes('.agentsmesh/skills/api-generator/references and') ||
          rootContent.includes('skills/api-generator/references and'),
      ).toBe(true);
      expect(
        rootContent.includes('../skills/api-generator/references/.') ||
          rootContent.includes('./skills/api-generator/references/.') ||
          rootContent.includes('.agentsmesh/skills/api-generator/references/.') ||
          rootContent.includes('skills/api-generator/references/.'),
      ).toBe(true);
      expect(rootContent).toContain('✓ / ✗');
      expect(
        rootContent.includes(`${mdSelfName}:42`) || rootContent.includes('typescript.md:42'),
      ).toBe(true);
      expect(
        rootContent.includes('`/docs/some-doc.md`') || rootContent.includes('`docs/some-doc.md`'),
      ).toBe(true);
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
        '[.agentsmesh/skills/api-generator/template.ts](../skills/api-generator/template.ts)',
      );
      expect(
        commandContent.includes('@.agentsmesh/skills/api-generator/SKILL.md') ||
          commandContent.includes('@../skills/api-generator/SKILL.md') ||
          commandContent.includes('@../../.cline/skills/api-generator/SKILL.md') ||
          commandContent.includes('@../api-generator/SKILL.md'),
      ).toBe(true);
      expect(commandContent).toContain(
        '".agentsmesh/skills/api-generator/references/route-checklist.md"',
      );
      expect(
        commandContent.includes('(../skills/api-generator/references/)') ||
          commandContent.includes('(./skills/api-generator/references/)') ||
          commandContent.includes('(.agentsmesh/skills/api-generator/references/)') ||
          commandContent.includes('(skills/api-generator/references/)'),
      ).toBe(true);
      expect(commandContent).toContain('✓ / ✗');
      assertDocs(commandContent);
      expect(commandContent).not.toContain(
        join(dir, '.agentsmesh', 'skills', 'api-generator', 'template.ts'),
      );
      if (target !== 'cline') {
        assertPortable(commandContent, targetPrefix[target]);
      }

      const cmdRel = '../commands/review.md';
      expect(agentContent).toContain(cmdRel);
      expect(agentContent).toContain(`[.agentsmesh/commands/review.md](${cmdRel})`);
      const structuredAtOk =
        target === 'cline'
          ? /Structured:[^\n]*@\S+/.test(agentContent)
          : agentContent.includes('@.agentsmesh/commands/review.md') ||
            agentContent.includes(`@${cmdRel}`) ||
            /@\.\.\/prompts\/review\.prompt\.md/.test(agentContent) ||
            /@\.\.\/commands\/review\.toml/.test(agentContent) ||
            /@\.\.\/\.\.\/workflows\/review\.md/.test(agentContent) ||
            /@\.\.\/\.\.\/\.cline\/skills\/api-generator\/SKILL\.md/.test(agentContent) ||
            /@\.\.\/\.\.\/\.agentsmesh\/commands\/review\.md/.test(agentContent) ||
            /@\.\.\/\.\.\/\.cline\/agents\//.test(agentContent) ||
            /@\.\.\/\.\.\/agents\//.test(agentContent) ||
            /@\.\.\/\.\.\/\.cline\//.test(agentContent) ||
            /@\.clinerules\//.test(agentContent);
      expect(structuredAtOk).toBe(true);
      expect(agentContent).toContain('".agentsmesh/commands/review.md"');
      expect(agentContent).toContain('(.agentsmesh/commands/review.md)');
      expect(agentContent).toContain('✓ / ✗');
      assertDocs(agentContent);
      expect(agentContent).not.toContain(join(dir, '.agentsmesh', 'commands', 'review.md'));
      assertPortable(agentContent, targetPrefix[target]);

      const ruleFromSkill = target === 'gemini-cli' ? 'GEMINI.md' : '../../rules/typescript.md';
      const ruleMarkdownFromSkill =
        target === 'gemini-cli'
          ? `[.agentsmesh/rules/typescript.md](../../../GEMINI.md)`
          : `[.agentsmesh/rules/typescript.md](${ruleFromSkill})`;
      expect(skillContent).toContain(ruleFromSkill);
      expect(skillContent).toContain(ruleMarkdownFromSkill);
      expect(
        skillContent.includes('@.agentsmesh/rules/typescript.md') ||
          skillContent.includes(`@${ruleFromSkill}`) ||
          /@\.\.\/.*(?:typescript|GEMINI|instructions)/i.test(skillContent),
      ).toBe(true);
      expect(
        skillContent.includes('".agentsmesh/skills/api-generator/references/"') ||
          skillContent.includes('"references/"') ||
          skillContent.includes('"./references/"') ||
          skillContent.includes('"skills/api-generator/references/"'),
      ).toBe(true);
      expect(
        skillContent.includes('(references/route-checklist.md)') ||
          skillContent.includes(
            '(.agentsmesh/skills/api-generator/references/route-checklist.md)',
          ) ||
          skillContent.includes('(skills/api-generator/references/route-checklist.md)'),
      ).toBe(true);
      expect(skillContent).toMatch(/Relative:.*template\.ts/);
      expect(skillContent).toContain('✓ / ✗');
      assertDocs(skillContent);
      expect(skillContent).not.toContain(
        join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'),
      );
      assertPortable(skillContent, targetPrefix[target]);

      expect(templateContent).toContain('../../commands/review.md');
      expect(templateContent).toContain(
        '[.agentsmesh/commands/review.md](../../commands/review.md)',
      );
      const templateAtOk =
        target === 'cline'
          ? /\/\/ Structured: @\S+/.test(templateContent)
          : templateContent.includes('@.agentsmesh/commands/review.md') ||
            templateContent.includes('@../../commands/review.md') ||
            templateContent.includes('@../../prompts/review.prompt.md') ||
            templateContent.includes('@../../commands/review.toml') ||
            templateContent.includes('@../../workflows/review.md') ||
            templateContent.includes('@../am-command-review/SKILL.md');
      expect(templateAtOk).toBe(true);
      expect(templateContent).toMatch(/references\/route-checklist\.md/);
      expect(
        templateContent.includes('(references/)') ||
          templateContent.includes('(.agentsmesh/skills/api-generator/references/)') ||
          templateContent.includes('(skills/api-generator/references/)'),
      ).toBe(true);
      expect(templateContent).toContain('✓ / ✗');
      expect(templateContent).toContain('../SKILL.md');
      assertDocs(templateContent);
      expect(templateContent).not.toContain(join(dir, '.agentsmesh', 'commands', 'review.md'));
      assertPortable(templateContent, targetPrefix[target]);
    },
  );
});

describe('import reference normalization — antigravity', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('normalizes imported references for antigravity using the canonical-full fixture', async () => {
    dir = createTestProject('canonical-full');
    appendReferenceVariants(dir);

    const generateResult = await runCli('generate --targets antigravity', dir);
    expect(generateResult.exitCode, generateResult.stderr).toBe(0);

    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });

    const importResult = await runCli('import --from antigravity', dir);
    expect(importResult.exitCode, importResult.stderr).toBe(0);

    const rootPath = join(dir, '.agentsmesh', 'rules', '_root.md');
    const commandPath = join(dir, '.agentsmesh', 'commands', 'review.md');
    const skillPath = join(dir, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md');

    fileExists(rootPath);
    fileExists(commandPath);
    fileExists(skillPath);

    const rootContent = readFileSync(rootPath, 'utf-8');
    const commandContent = readFileSync(commandPath, 'utf-8');
    const skillContent = readFileSync(skillPath, 'utf-8');

    expect(rootContent).toContain('typescript.md');
    expect(rootContent).toContain('.agentsmesh/commands/review.md');
    expect(rootContent).toContain('.agentsmesh/agents/code-reviewer.md');
    expect(rootContent).toContain('.agentsmesh/skills/api-generator/SKILL.md');
    expect(rootContent).not.toContain('.agents/rules/');
    expect(rootContent).not.toContain('.agents/skills/');
    expect(rootContent).not.toContain('.agents/workflows/');
    expect(rootContent).toContain('✓ / ✗');
    assertExternalRefs(rootContent);
    assertDocs(rootContent);

    expect(commandContent).toContain('.agentsmesh/skills/api-generator/SKILL.md');
    expect(commandContent).not.toContain('.agents/');

    expect(skillContent).toContain('../../rules/typescript.md');
    expect(skillContent).not.toContain('.agents/');
  });
});
