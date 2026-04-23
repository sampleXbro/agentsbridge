import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('roo-code global layout — paths', () => {
  const layout = getTargetLayout('roo-code', 'global')!;

  it('resolves rule path to .roo/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.roo/rules/typescript.md');
  });

  it('resolves command path to .roo/commands/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe('.roo/commands/deploy.md');
  });

  it('suppresses agent path (returns null)', () => {
    expect(layout.paths.agentPath('my-agent', {} as never)).toBeNull();
  });
});

describe('roo-code global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('roo-code', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .roo/rules/00-root.md to .roo/AGENTS.md', () => {
    expect(rewrite('.roo/rules/00-root.md')).toBe('.roo/AGENTS.md');
  });

  it('keeps .roo/rules/ paths unchanged', () => {
    expect(rewrite('.roo/rules/typescript.md')).toBe('.roo/rules/typescript.md');
  });

  it('keeps .roo/commands/ paths unchanged', () => {
    expect(rewrite('.roo/commands/deploy.md')).toBe('.roo/commands/deploy.md');
  });

  it('keeps .roo/skills/ paths unchanged', () => {
    expect(rewrite('.roo/skills/ts-pro/SKILL.md')).toBe('.roo/skills/ts-pro/SKILL.md');
  });

  it('rewrites .roo/mcp.json to mcp_settings.json', () => {
    expect(rewrite('.roo/mcp.json')).toBe('mcp_settings.json');
  });

  it('keeps .rooignore unchanged', () => {
    expect(rewrite('.rooignore')).toBe('.rooignore');
  });

  it('suppresses .roomodes in global mode (returns null)', () => {
    expect(rewrite('.roomodes')).toBeNull();
  });
});

describe('roo-code global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('roo-code', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .roo/skills/ to .agents/skills/', () => {
    expect(mirror('.roo/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .roo/skills/', () => {
    expect(mirror('.roo/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.roo/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror('.roo/AGENTS.md', [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror('.roo/commands/commit.md', [])).toBeNull();
  });
});
