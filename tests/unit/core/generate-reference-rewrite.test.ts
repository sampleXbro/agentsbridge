import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generate } from '../../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';
import { appendAgentsmeshRootInstructionParagraph } from '../../../src/targets/projection/root-instruction-paragraph.js';

const TEST_DIR = join(tmpdir(), 'am-engine-reference-rewrite');

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
        source: join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
        root: true,
        targets: [],
        description: 'Root rule',
        globs: [],
        body: 'See `.agentsmesh/rules/typescript.md`, `.agentsmesh/commands/review.md`, `.agentsmesh/agents/reviewer.md`, and `.agentsmesh/skills/api-gen/references/checklist.md`.',
      },
      {
        source: join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'),
        root: false,
        targets: [],
        description: 'TypeScript rule',
        globs: ['src/**/*.ts'],
        body: 'Prefer strict mode.',
      },
    ],
    commands: [
      {
        source: join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
        name: 'review',
        description: 'Run review',
        allowedTools: [],
        body: 'Load `.agentsmesh/skills/api-gen/SKILL.md`.',
      },
    ],
    agents: [
      {
        source: join(TEST_DIR, '.agentsmesh', 'agents', 'reviewer.md'),
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
        body: 'Use `.agentsmesh/skills/api-gen/SKILL.md`.',
      },
    ],
    skills: [
      {
        source: join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
        name: 'api-gen',
        description: 'Generate APIs',
        body: 'Checklist at `.agentsmesh/skills/api-gen/references/checklist.md`.',
        supportingFiles: [
          {
            relativePath: 'references/checklist.md',
            absolutePath: join(
              TEST_DIR,
              '.agentsmesh',
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
      'rules/typescript.md',
    );
    expect(results.find((result) => result.path === '.claude/CLAUDE.md')?.content).toContain(
      'commands/review.md',
    );
    expect(
      results.find((result) => result.path === '.cursor/rules/general.mdc')?.content,
    ).toContain('typescript.mdc');
    expect(
      results.find((result) => result.path === '.cursor/rules/general.mdc')?.content,
    ).toContain('../commands/review.md');
  });

  it.each([
    ['claude-code', '.claude/CLAUDE.md', 'skills/api-gen/', 'skills/api-gen/references/'],
    ['cursor', '.cursor/rules/general.mdc', '../skills/api-gen/', '../skills/api-gen/references/'],
    ['copilot', '.github/copilot-instructions.md', 'skills/api-gen/', 'skills/api-gen/references/'],
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
        body: 'Use `.agentsmesh/skills/api-gen/` and `.agentsmesh/skills/api-gen/references/`.',
      };

      const results = await generate({
        config: rewriteConfig([target]),
        canonical,
        projectRoot: TEST_DIR,
      });

      const content = results.find((result) => result.path === outputPath)?.content ?? '';
      expect(content).toContain(expectedSkillDir);
      expect(content).toContain(expectedRefDir);
      expect(content).not.toContain('.agentsmesh/skills/api-gen/');
    },
  );

  it('rewrites skill directory references in cline AGENTS.md compatibility mirror', async () => {
    const canonical = rewriteCanonical();
    canonical.rules[0] = {
      ...canonical.rules[0]!,
      body: 'Use `.agentsmesh/skills/api-gen/` and `.agentsmesh/skills/api-gen/references/`.',
    };

    const results = await generate({
      config: rewriteConfig(['cline']),
      canonical,
      projectRoot: TEST_DIR,
    });

    const content = results.find((result) => result.path === 'AGENTS.md')?.content ?? '';
    expect(content).toContain('.cline/skills/api-gen/');
    expect(content).toContain('.cline/skills/api-gen/references/');
    expect(content).not.toContain('.agentsmesh/skills/api-gen/');
  });

  it.each([
    // windsurf: root aggregates to .codeium/windsurf/memories/, skills under .codeium/windsurf/skills/
    [
      'windsurf',
      '.codeium/windsurf/memories/global_rules.md',
      '../skills/api-gen/',
      '../skills/api-gen/references/',
    ],
    // copilot: root at .copilot/copilot-instructions.md, skills under .copilot/skills/
    [
      'copilot',
      '.copilot/copilot-instructions.md',
      'skills/api-gen/',
      'skills/api-gen/references/',
    ],
    // cursor: same path structure in global mode; root at .cursor/rules/general.mdc
    ['cursor', '.cursor/rules/general.mdc', '../skills/api-gen/', '../skills/api-gen/references/'],
    // claude-code: same path structure in global mode; root at .claude/CLAUDE.md
    ['claude-code', '.claude/CLAUDE.md', 'skills/api-gen/', 'skills/api-gen/references/'],
    // gemini-cli: root aggregates to .gemini/GEMINI.md, skills under .gemini/skills/
    ['gemini-cli', '.gemini/GEMINI.md', 'skills/api-gen/', 'skills/api-gen/references/'],
  ] as const)(
    'rewrites skill directory references in global mode root output for %s',
    async (target, outputPath, expectedSkillDir, expectedRefDir) => {
      const canonical = rewriteCanonical();
      canonical.rules[0] = {
        ...canonical.rules[0]!,
        body: 'Use `.agentsmesh/skills/api-gen/` and `.agentsmesh/skills/api-gen/references/`.',
      };

      const results = await generate({
        config: rewriteConfig([target]),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const content = results.find((result) => result.path === outputPath)?.content ?? '';
      expect(content).toContain(expectedSkillDir);
      expect(content).toContain(expectedRefDir);
      expect(content).not.toContain('.agentsmesh/skills/api-gen/');
    },
  );

  it.each([
    ['kiro', 'codex-cli'],
    ['claude-code', 'codex-cli'],
    ['windsurf', 'codex-cli'],
    ['cursor', 'codex-cli'],
    ['copilot', 'codex-cli'],
    ['gemini-cli', 'codex-cli'],
    ['cline'],
    ['continue'],
  ] as const)(
    'rewrites skill directory references correctly in .agents/skills/ mirror for %s',
    async (...targetArgs) => {
      const targets = targetArgs as unknown as string[];
      const canonical = rewriteCanonical();
      canonical.skills[0] = {
        ...canonical.skills[0]!,
        body: 'Use `.agentsmesh/skills/api-gen/` and `.agentsmesh/skills/api-gen/references/`.',
      };

      const results = await generate({
        config: rewriteConfig(targets as ValidatedConfig['targets']),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const mirrorResult = results.find((r) => r.path === '.agents/skills/api-gen/SKILL.md');
      expect(mirrorResult).toBeDefined();
      const content = mirrorResult!.content;
      // Self-referencing skill dir becomes './' (correct shortest relative path).
      // The references/ subdir should be just 'references/', not '../../../<target>/skills/.../references/'.
      expect(content).toContain('references/');
      expect(content).not.toContain('.agentsmesh/');
      expect(content).not.toContain('../../../');
    },
  );

  it('recomputes file status after rewriting generated content', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'CLAUDE.md'),
      appendAgentsmeshRootInstructionParagraph(
        'See ./rules/typescript.md, ./commands/review.md, ./agents/reviewer.md, and ./skills/api-gen/references/checklist.md.',
      ),
    );

    const results = await generate({
      config: rewriteConfig(['claude-code']),
      canonical: rewriteCanonical(),
      projectRoot: TEST_DIR,
    });

    expect(results).toContainEqual(
      expect.objectContaining({
        path: '.claude/CLAUDE.md',
        status: 'updated',
      }),
    );
  });
});
