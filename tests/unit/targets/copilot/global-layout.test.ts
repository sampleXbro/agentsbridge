import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

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

  it('suppresses .github/instructions/ in global mode (returns null)', () => {
    expect(rewrite('.github/instructions/review.instructions.md')).toBeNull();
  });

  it('suppresses .github/hooks/ in global mode (returns null)', () => {
    expect(rewrite('.github/hooks/scripts/pre-commit.sh')).toBeNull();
  });
});

describe('copilot global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('copilot', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .copilot/skills/ to .agents/skills/', () => {
    expect(mirror('.copilot/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .copilot/skills/', () => {
    expect(mirror('.copilot/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
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
