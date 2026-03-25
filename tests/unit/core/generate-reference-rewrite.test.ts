import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generate } from '../../../src/core/engine.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/schema.js';

const TEST_DIR = join(tmpdir(), 'ab-engine-reference-rewrite');

function rewriteConfig(targets: ValidatedConfig['targets']): ValidatedConfig {
  return {
    version: 1,
    targets,
    features: ['rules', 'commands', 'agents', 'skills'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function rewriteCanonical(): CanonicalFiles {
  return {
    rules: [
      {
        source: join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'),
        root: true,
        targets: [],
        description: 'Root rule',
        globs: [],
        body: 'See .agentsbridge/rules/typescript.md, .agentsbridge/commands/review.md, .agentsbridge/agents/reviewer.md, and .agentsbridge/skills/api-gen/references/checklist.md.',
      },
      {
        source: join(TEST_DIR, '.agentsbridge', 'rules', 'typescript.md'),
        root: false,
        targets: [],
        description: 'TypeScript rule',
        globs: ['src/**/*.ts'],
        body: 'Prefer strict mode.',
      },
    ],
    commands: [
      {
        source: join(TEST_DIR, '.agentsbridge', 'commands', 'review.md'),
        name: 'review',
        description: 'Run review',
        allowedTools: [],
        body: 'Load .agentsbridge/skills/api-gen/SKILL.md.',
      },
    ],
    agents: [
      {
        source: join(TEST_DIR, '.agentsbridge', 'agents', 'reviewer.md'),
        name: 'reviewer',
        description: 'Reviews code',
        tools: ['Read'],
        disallowedTools: [],
        model: 'sonnet',
        permissionMode: 'default',
        maxTurns: 5,
        mcpServers: [],
        hooks: {},
        skills: [],
        memory: '',
        body: 'Use .agentsbridge/skills/api-gen/SKILL.md.',
      },
    ],
    skills: [
      {
        source: join(TEST_DIR, '.agentsbridge', 'skills', 'api-gen', 'SKILL.md'),
        name: 'api-gen',
        description: 'Generate APIs',
        body: 'Checklist at .agentsbridge/skills/api-gen/references/checklist.md.',
        supportingFiles: [
          {
            relativePath: 'references/checklist.md',
            absolutePath: join(
              TEST_DIR,
              '.agentsbridge',
              'skills',
              'api-gen',
              'references',
              'checklist.md',
            ),
            content: 'Checklist',
          },
        ],
      },
    ],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('generate reference rewriting', () => {
  it('rewrites canonical references in generated markdown outputs for each target', async () => {
    const results = await generate({
      config: rewriteConfig(['claude-code', 'cursor']),
      canonical: rewriteCanonical(),
      projectRoot: TEST_DIR,
    });

    expect(results.find((result) => result.path === '.claude/CLAUDE.md')?.content).toContain(
      '.claude/rules/typescript.md',
    );
    expect(results.find((result) => result.path === '.claude/CLAUDE.md')?.content).toContain(
      '.claude/commands/review.md',
    );
    expect(
      results.find((result) => result.path === '.cursor/rules/general.mdc')?.content,
    ).toContain('.cursor/rules/typescript.mdc');
    expect(
      results.find((result) => result.path === '.cursor/rules/general.mdc')?.content,
    ).toContain('.cursor/commands/review.md');
  });

  it.each([
    [
      'claude-code',
      '.claude/CLAUDE.md',
      '.claude/skills/api-gen/',
      '.claude/skills/api-gen/references/',
    ],
    [
      'cursor',
      '.cursor/rules/general.mdc',
      '.cursor/skills/api-gen/',
      '.cursor/skills/api-gen/references/',
    ],
    [
      'copilot',
      '.github/copilot-instructions.md',
      '.github/skills/api-gen/',
      '.github/skills/api-gen/references/',
    ],
    ['gemini-cli', 'GEMINI.md', '.gemini/skills/api-gen/', '.gemini/skills/api-gen/references/'],
    ['cline', 'AGENTS.md', '.cline/skills/api-gen/', '.cline/skills/api-gen/references/'],
    ['codex-cli', 'AGENTS.md', '.agents/skills/api-gen/', '.agents/skills/api-gen/references/'],
    ['windsurf', 'AGENTS.md', '.windsurf/skills/api-gen/', '.windsurf/skills/api-gen/references/'],
  ] as const)(
    'rewrites skill directory references in root output for %s',
    async (target, outputPath, expectedSkillDir, expectedRefDir) => {
      const canonical = rewriteCanonical();
      canonical.rules[0] = {
        ...canonical.rules[0]!,
        body: 'Use .agentsbridge/skills/api-gen/ and .agentsbridge/skills/api-gen/references/.',
      };

      const results = await generate({
        config: rewriteConfig([target]),
        canonical,
        projectRoot: TEST_DIR,
      });

      const content = results.find((result) => result.path === outputPath)?.content ?? '';
      expect(content).toContain(expectedSkillDir);
      expect(content).toContain(expectedRefDir);
      expect(content).not.toContain('.agentsbridge/skills/api-gen/');
    },
  );

  it('rewrites skill directory references in cline AGENTS.md compatibility mirror', async () => {
    const canonical = rewriteCanonical();
    canonical.rules[0] = {
      ...canonical.rules[0]!,
      body: 'Use .agentsbridge/skills/api-gen/ and .agentsbridge/skills/api-gen/references/.',
    };

    const results = await generate({
      config: rewriteConfig(['cline']),
      canonical,
      projectRoot: TEST_DIR,
    });

    const content = results.find((result) => result.path === 'AGENTS.md')?.content ?? '';
    expect(content).toContain('.cline/skills/api-gen/');
    expect(content).toContain('.cline/skills/api-gen/references/');
    expect(content).not.toContain('.agentsbridge/skills/api-gen/');
  });

  it('recomputes file status after rewriting generated content', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'CLAUDE.md'),
      'See .claude/rules/typescript.md, .claude/commands/review.md, .claude/agents/reviewer.md, and .claude/skills/api-gen/references/checklist.md.',
    );

    const results = await generate({
      config: rewriteConfig(['claude-code']),
      canonical: rewriteCanonical(),
      projectRoot: TEST_DIR,
    });

    expect(results).toContainEqual(
      expect.objectContaining({
        path: '.claude/CLAUDE.md',
        status: 'unchanged',
      }),
    );
  });
});
