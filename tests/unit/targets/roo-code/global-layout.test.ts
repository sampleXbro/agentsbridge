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

  it('resolves agent path to null (not supported)', () => {
    expect(layout.paths.agentPath('my-agent', {} as never)).toBeNull();
  });
});

describe('roo-code global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('roo-code', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .roo/rules/00-root.md to .roo/AGENTS.md', () => {
    expect(rewrite('.roo/rules/00-root.md')).toBe('.roo/AGENTS.md');
  });

  it('rewrites .roo/rules/*.md to .roo/rules/*.md', () => {
    expect(rewrite('.roo/rules/typescript.md')).toBe('.roo/rules/typescript.md');
    expect(rewrite('.roo/rules/general.md')).toBe('.roo/rules/general.md');
  });

  it('rewrites .roo/skills/ to .roo/skills/', () => {
    expect(rewrite('.roo/skills/ts-pro/SKILL.md')).toBe('.roo/skills/ts-pro/SKILL.md');
  });

  it('rewrites .roo/commands/ to .roo/commands/', () => {
    expect(rewrite('.roo/commands/commit.md')).toBe('.roo/commands/commit.md');
  });

  it('rewrites .roo/mcp.json to mcp_settings.json', () => {
    expect(rewrite('.roo/mcp.json')).toBe('mcp_settings.json');
  });

  it('rewrites .rooignore to .rooignore (identity)', () => {
    expect(rewrite('.rooignore')).toBe('.rooignore');
  });

  it('returns unmodified path for unknown paths', () => {
    expect(rewrite('.roo/other/file.txt')).toBe('.roo/other/file.txt');
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

  it('returns null for rule files (not mirrored)', () => {
    expect(mirror('.roo/rules/typescript.md', [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror('.roo/commands/commit.md', [])).toBeNull();
  });

  it('returns null for MCP file (not mirrored)', () => {
    expect(mirror('mcp_settings.json', [])).toBeNull();
  });

  it('returns null for ignore file (not mirrored)', () => {
    expect(mirror('.rooignore', [])).toBeNull();
  });
});
