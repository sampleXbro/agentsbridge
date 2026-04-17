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
    expect(layout.paths.commandPath('review', {} as never)).toBe('.claude/commands/review.md');
  });

  it('resolves agent path to .claude/agents/', () => {
    expect(layout.paths.agentPath('reviewer', {} as never)).toBe('.claude/agents/reviewer.md');
  });
});

describe('claude-code global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('claude-code', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .mcp.json to .claude.json', () => {
    expect(rewrite('.mcp.json')).toBe('.claude.json');
  });

  it('keeps .claude/CLAUDE.md unchanged', () => {
    expect(rewrite('.claude/CLAUDE.md')).toBe('.claude/CLAUDE.md');
  });

  it('keeps .claude/rules/ paths unchanged', () => {
    expect(rewrite('.claude/rules/typescript.md')).toBe('.claude/rules/typescript.md');
  });

  it('keeps .claude/commands/ paths unchanged', () => {
    expect(rewrite('.claude/commands/review.md')).toBe('.claude/commands/review.md');
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

  it('keeps .claude/hooks.json unchanged', () => {
    expect(rewrite('.claude/hooks.json')).toBe('.claude/hooks.json');
  });

  it('keeps .claudeignore unchanged', () => {
    expect(rewrite('.claudeignore')).toBe('.claudeignore');
  });
});

describe('claude-code global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('claude-code', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .claude/skills/ to .agents/skills/', () => {
    expect(mirror('.claude/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .claude/skills/', () => {
    expect(mirror('.claude/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.claude/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for rule files (not mirrored)', () => {
    expect(mirror('.claude/rules/typescript.md', [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror('.claude/commands/review.md', [])).toBeNull();
  });

  it('returns null for agent files (not mirrored)', () => {
    expect(mirror('.claude/agents/reviewer.md', [])).toBeNull();
  });

  it('returns null for MCP file (not mirrored)', () => {
    expect(mirror('.claude.json', [])).toBeNull();
  });
});
