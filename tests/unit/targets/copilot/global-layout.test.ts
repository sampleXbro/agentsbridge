import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';

describe('copilot global layout — paths', () => {
  const layout = getTargetLayout('copilot', 'global')!;

  it('resolves rule path to .copilot/copilot-instructions.md (aggregate)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.copilot/copilot-instructions.md');
  });

  it('resolves command path to .copilot/prompts/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      '.copilot/prompts/deploy.prompt.md',
    );
  });

  it('resolves agent path to .copilot/agents/', () => {
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.copilot/agents/my-agent.agent.md');
  });
});

describe('copilot global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('copilot', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .github/copilot-instructions.md to .copilot/copilot-instructions.md', () => {
    expect(rewrite('.github/copilot-instructions.md')).toBe('.copilot/copilot-instructions.md');
  });

  it('rewrites .github/prompts/ to .copilot/prompts/', () => {
    expect(rewrite('.github/prompts/deploy.prompt.md')).toBe('.copilot/prompts/deploy.prompt.md');
  });

  it('rewrites .github/agents/ to .copilot/agents/', () => {
    expect(rewrite('.github/agents/my-agent.agent.md')).toBe('.copilot/agents/my-agent.agent.md');
  });

  it('rewrites .github/skills/ to .copilot/skills/', () => {
    expect(rewrite('.github/skills/ts-pro/SKILL.md')).toBe('.copilot/skills/ts-pro/SKILL.md');
  });

  it('aggregates .github/instructions/ into root instructions in global mode', () => {
    expect(rewrite('.github/instructions/review.instructions.md')).toBe(
      '.copilot/copilot-instructions.md',
    );
  });

  it('suppresses .github/hooks/ in global mode (returns null)', () => {
    expect(rewrite('.github/hooks/scripts/pre-commit.sh')).toBeNull();
  });
});

describe('copilot global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('copilot', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .copilot/skills/ to .agents/skills/ and .claude/skills/', () => {
    expect(mirror('.copilot/skills/ts-pro/SKILL.md', [])).toEqual([
      '.agents/skills/ts-pro/SKILL.md',
      '.claude/skills/ts-pro/SKILL.md',
    ]);
  });

  it('mirrors nested supporting file under .copilot/skills/', () => {
    expect(mirror('.copilot/skills/ts-pro/references/checklist.md', [])).toEqual([
      '.agents/skills/ts-pro/references/checklist.md',
      '.claude/skills/ts-pro/references/checklist.md',
    ]);
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.copilot/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for instruction file (not mirrored)', () => {
    expect(mirror('.copilot/copilot-instructions.md', [])).toBeNull();
  });

  it('returns null for prompt files (not mirrored)', () => {
    expect(mirror('.copilot/prompts/commit.prompt.md', [])).toBeNull();
  });
});

describe('copilot global layout — engine emits dual mirror end-to-end', () => {
  const TEST_DIR = join(tmpdir(), 'am-copilot-global-dual-mirror');

  function makeConfig(targets: readonly string[]): ValidatedConfig {
    return {
      version: 1,
      targets: [...targets],
      features: ['rules', 'skills'],
      extends: [],
      overrides: {},
      collaboration: { strategy: 'merge', lock_features: [] },
    };
  }

  function makeCanonical(): CanonicalFiles {
    return {
      rules: [
        {
          source: join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
          root: true,
          targets: [],
          description: 'Root rule',
          globs: [],
          body: '# Root\nUse TypeScript.',
        },
      ],
      commands: [],
      agents: [],
      skills: [
        {
          source: join(TEST_DIR, '.agentsmesh', 'skills', 'ts-pro', 'SKILL.md'),
          name: 'ts-pro',
          description: 'TypeScript expert',
          body: '# TS Pro skill body',
          supportingFiles: [
            {
              relativePath: 'references/checklist.md',
              absolutePath: join(
                TEST_DIR,
                '.agentsmesh',
                'skills',
                'ts-pro',
                'references',
                'checklist.md',
              ),
              content: 'Checklist content',
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

  it('emits both .agents/skills/<name>/ AND .claude/skills/<name>/ when codex-cli is NOT active', async () => {
    const results = await generate({
      config: makeConfig(['copilot']),
      canonical: makeCanonical(),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const skillPaths = results
      .filter((r) => r.target === 'copilot' && r.path.endsWith('.md'))
      .map((r) => r.path)
      .filter((p) => p.includes('/skills/'))
      .sort();

    expect(skillPaths).toEqual([
      '.agents/skills/ts-pro/SKILL.md',
      '.agents/skills/ts-pro/references/checklist.md',
      '.claude/skills/ts-pro/SKILL.md',
      '.claude/skills/ts-pro/references/checklist.md',
      '.copilot/skills/ts-pro/SKILL.md',
      '.copilot/skills/ts-pro/references/checklist.md',
    ]);
  });

  it('skips the .agents/skills/ mirror when codex-cli is also being generated (codex owns that prefix)', async () => {
    const results = await generate({
      config: makeConfig(['copilot', 'codex-cli']),
      canonical: makeCanonical(),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const copilotSkillPaths = results
      .filter((r) => r.target === 'copilot' && r.path.endsWith('.md'))
      .map((r) => r.path)
      .filter((p) => p.includes('/skills/'))
      .sort();

    expect(copilotSkillPaths).toEqual([
      '.copilot/skills/ts-pro/SKILL.md',
      '.copilot/skills/ts-pro/references/checklist.md',
    ]);
  });
});
