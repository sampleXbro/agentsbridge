import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('gemini-cli global layout — paths', () => {
  const layout = getTargetLayout('gemini-cli', 'global')!;

  it('resolves rule path to .gemini/GEMINI.md (aggregate)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.gemini/GEMINI.md');
  });

  it('resolves command path to .gemini/commands/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe('.gemini/commands/deploy.toml');
  });

  it('resolves namespaced command path', () => {
    expect(layout.paths.commandPath('tools:deploy', {} as never)).toBe(
      '.gemini/commands/tools/deploy.toml',
    );
  });

  it('resolves agent path to .gemini/agents/', () => {
    expect(
      layout.paths.agentPath('reviewer', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.gemini/agents/reviewer.md');
  });
});

describe('gemini-cli global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('gemini-cli', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites GEMINI.md to .gemini/GEMINI.md', () => {
    expect(rewrite('GEMINI.md')).toBe('.gemini/GEMINI.md');
  });

  it('rewrites AGENTS.md to .gemini/AGENTS.md', () => {
    expect(rewrite('AGENTS.md')).toBe('.gemini/AGENTS.md');
  });

  it('rewrites .gemini/settings.json unchanged (identity)', () => {
    expect(rewrite('.gemini/settings.json')).toBe('.gemini/settings.json');
  });

  it('keeps .gemini/commands/ paths unchanged', () => {
    expect(rewrite('.gemini/commands/deploy.toml')).toBe('.gemini/commands/deploy.toml');
  });

  it('keeps .gemini/skills/ paths unchanged', () => {
    expect(rewrite('.gemini/skills/ts-pro/SKILL.md')).toBe('.gemini/skills/ts-pro/SKILL.md');
  });

  it('keeps .gemini/agents/ paths unchanged', () => {
    expect(rewrite('.gemini/agents/reviewer.md')).toBe('.gemini/agents/reviewer.md');
  });

  it('suppresses .gemini/policies/ in global mode (returns null)', () => {
    expect(rewrite('.gemini/policies/permissions.toml')).toBeNull();
  });

  it('suppresses .geminiignore in global mode (returns null)', () => {
    expect(rewrite('.geminiignore')).toBeNull();
  });

  it('returns unchanged path for unrecognized paths', () => {
    expect(rewrite('.gemini/other/file.md')).toBe('.gemini/other/file.md');
  });
});

describe('gemini-cli global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('gemini-cli', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .gemini/skills/ to .agents/skills/', () => {
    expect(mirror('.gemini/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .gemini/skills/', () => {
    expect(mirror('.gemini/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.gemini/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for GEMINI.md (not mirrored)', () => {
    expect(mirror('.gemini/GEMINI.md', [])).toBeNull();
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror('.gemini/AGENTS.md', [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror('.gemini/commands/deploy.toml', [])).toBeNull();
  });

  it('returns null for agent files (not mirrored)', () => {
    expect(mirror('.gemini/agents/reviewer.md', [])).toBeNull();
  });
});
