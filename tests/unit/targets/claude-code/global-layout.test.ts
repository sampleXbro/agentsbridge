import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('claude-code global layout — paths', () => {
  const layout = getTargetLayout('claude-code', 'global')!;

  it('resolves rule path to .claude/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.claude/rules/typescript.md');
  });

  it('resolves command path to .claude/commands/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe('.claude/commands/deploy.md');
  });

  it('resolves agent path to .claude/agents/', () => {
    expect(
      layout.paths.agentPath('reviewer', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.claude/agents/reviewer.md');
  });
});

describe('claude-code global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('claude-code', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .mcp.json to .claude.json', () => {
    expect(rewrite('.mcp.json')).toBe('.claude.json');
  });

  it('keeps CLAUDE.md unchanged (already in global form)', () => {
    expect(rewrite('.claude/CLAUDE.md')).toBe('.claude/CLAUDE.md');
  });

  it('keeps .claude/rules/ paths unchanged', () => {
    expect(rewrite('.claude/rules/typescript.md')).toBe('.claude/rules/typescript.md');
  });

  it('keeps .claude/commands/ paths unchanged', () => {
    expect(rewrite('.claude/commands/deploy.md')).toBe('.claude/commands/deploy.md');
  });

  it('keeps .claude/agents/ paths unchanged', () => {
    expect(rewrite('.claude/agents/reviewer.md')).toBe('.claude/agents/reviewer.md');
  });

  it('keeps .claude/skills/ paths unchanged', () => {
    expect(rewrite('.claude/skills/ts-pro/SKILL.md')).toBe('.claude/skills/ts-pro/SKILL.md');
  });

  it('keeps .claude/settings.json unchanged', () => {
    expect(rewrite('.claude/settings.json')).toBe('.claude/settings.json');
  });

  it('keeps .claudeignore unchanged', () => {
    expect(rewrite('.claudeignore')).toBe('.claudeignore');
  });
});
