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
      './rules/typescript.md',
    );
    expect(results.find((result) => result.path === '.claude/CLAUDE.md')?.content).toContain(
      './commands/review.md',
    );
    expect(
      results.find((result) => result.path === '.cursor/rules/general.mdc')?.content,
    ).toContain('typescript.md');
    expect(
      results.find((result) => result.path === '.cursor/rules/general.mdc')?.content,
    ).toContain('commands/review.md');
  });

  it.each([
    ['claude-code', '.claude/CLAUDE.md'],
    ['cursor', '.cursor/rules/general.mdc'],
    ['copilot', '.github/copilot-instructions.md'],
    ['gemini-cli', 'GEMINI.md'],
    ['cline', 'AGENTS.md'],
    ['codex-cli', 'AGENTS.md'],
    ['windsurf', 'AGENTS.md'],
  ] as const)(
    'rewrites skill directory references in root output for %s',
    async (target, outputPath) => {
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
      expect(content).toContain('skills/api-gen/');
      expect(content).toContain('skills/api-gen/references/');
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
    expect(content).toContain('skills/api-gen/');
    expect(content).toContain('skills/api-gen/references/');
  });

  it.each([
    ['windsurf', '.codeium/windsurf/memories/global_rules.md', '.codeium/windsurf/skills/api-gen/'],
    ['copilot', '.copilot/copilot-instructions.md', '.copilot/skills/api-gen/'],
    ['cursor', '.cursor/rules/general.mdc', '.cursor/skills/api-gen/'],
    ['claude-code', '.claude/CLAUDE.md', '.claude/skills/api-gen/'],
    ['gemini-cli', '.gemini/GEMINI.md', '.gemini/skills/api-gen/'],
  ] as const)(
    'rewrites skill directory prose references to colocated target paths in global mode root output for %s',
    async (target, outputPath, expectedSkillDir) => {
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
      expect(content).toContain(`\`${expectedSkillDir}\``);
      expect(content).toContain(`\`${expectedSkillDir}references/\``);
    },
  );

  it.each([
    ['windsurf', '.codeium/windsurf/memories/global_rules.md', '../skills/api-gen/'],
    ['copilot', '.copilot/copilot-instructions.md', './skills/api-gen/'],
    ['cursor', '.cursor/rules/general.mdc', '../skills/api-gen/'],
    ['claude-code', '.claude/CLAUDE.md', './skills/api-gen/'],
    ['gemini-cli', '.gemini/GEMINI.md', './skills/api-gen/'],
  ] as const)(
    'rewrites skill directory markdown destinations in global mode root output for %s',
    async (target, outputPath, expectedSkillDir) => {
      const canonical = rewriteCanonical();
      canonical.rules[0] = {
        ...canonical.rules[0]!,
        body: 'Use [api-gen](.agentsmesh/skills/api-gen/).',
      };

      const results = await generate({
        config: rewriteConfig([target]),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const content = results.find((result) => result.path === outputPath)?.content ?? '';
      expect(content).toContain(`[api-gen](${expectedSkillDir})`);
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
      // Mirror artifacts share the `.agents/skills/api-gen/` location, so the
      // canonical reference projects to that colocated path.
      expect(content).toContain('`.agents/skills/api-gen/`');
      expect(content).toContain('`.agents/skills/api-gen/references/`');
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
