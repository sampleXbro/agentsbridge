import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('codex-cli global layout — paths', () => {
  const layout = getTargetLayout('codex-cli', 'global')!;

  it('resolves advisory rule path to .codex/AGENTS.md (aggregate)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
        codexEmit: 'advisory',
      }),
    ).toBe('.codex/AGENTS.md');
  });

  it('resolves execution rule path to .codex/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
        codexEmit: 'execution',
      }),
    ).toBe('.codex/rules/typescript.rules');
  });

  it('resolves agent path to .codex/agents/', () => {
    expect(layout.paths.agentPath('reviewer', {} as never)).toBe('.codex/agents/reviewer.toml');
  });
});

describe('codex-cli global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('codex-cli', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites AGENTS.md to .codex/AGENTS.md', () => {
    expect(rewrite('AGENTS.md')).toBe('.codex/AGENTS.md');
  });

  it('suppresses .codex/instructions/ paths (returns null)', () => {
    expect(rewrite('.codex/instructions/typescript.md')).toBeNull();
  });

  it('keeps .agents/skills/ paths unchanged', () => {
    expect(rewrite('.agents/skills/ts-pro/SKILL.md')).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('keeps .codex/agents/ paths unchanged', () => {
    expect(rewrite('.codex/agents/reviewer.toml')).toBe('.codex/agents/reviewer.toml');
  });

  it('keeps .codex/config.toml unchanged', () => {
    expect(rewrite('.codex/config.toml')).toBe('.codex/config.toml');
  });

  it('keeps .codex/rules/ paths unchanged', () => {
    expect(rewrite('.codex/rules/typescript.rules')).toBe('.codex/rules/typescript.rules');
  });

  it('returns unchanged path for unrecognized paths', () => {
    expect(rewrite('.codex/other/file.md')).toBe('.codex/other/file.md');
  });
});

describe('codex-cli global layout — no mirrorGlobalPath', () => {
  const layout = getTargetLayout('codex-cli', 'global')!;

  it('has no mirrorGlobalPath (codex-cli owns .agents/skills/ directly)', () => {
    expect(layout.mirrorGlobalPath).toBeUndefined();
  });
});
