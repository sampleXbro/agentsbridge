import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('junie global layout — paths', () => {
  const layout = getTargetLayout('junie', 'global')!;

  it('resolves rule path to .junie/AGENTS.md (aggregate)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.junie/AGENTS.md');
  });

  it('resolves command path to .junie/commands/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe('.junie/commands/deploy.md');
  });

  it('resolves agent path to .junie/agents/', () => {
    expect(layout.paths.agentPath('my-agent', {} as never)).toBe('.junie/agents/my-agent.md');
  });
});

describe('junie global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('junie', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .junie/AGENTS.md to .junie/AGENTS.md (identity)', () => {
    expect(rewrite('.junie/AGENTS.md')).toBe('.junie/AGENTS.md');
  });

  it('rewrites .junie/rules/*.md to .junie/AGENTS.md (aggregate)', () => {
    expect(rewrite('.junie/rules/typescript.md')).toBe('.junie/AGENTS.md');
    expect(rewrite('.junie/rules/general.md')).toBe('.junie/AGENTS.md');
  });

  it('rewrites .junie/skills/ to .junie/skills/', () => {
    expect(rewrite('.junie/skills/ts-pro/SKILL.md')).toBe('.junie/skills/ts-pro/SKILL.md');
  });

  it('rewrites .junie/commands/ to .junie/commands/', () => {
    expect(rewrite('.junie/commands/commit.md')).toBe('.junie/commands/commit.md');
  });

  it('rewrites .junie/agents/ to .junie/agents/', () => {
    expect(rewrite('.junie/agents/reviewer.md')).toBe('.junie/agents/reviewer.md');
  });

  it('rewrites .junie/mcp/mcp.json to .junie/mcp/mcp.json', () => {
    expect(rewrite('.junie/mcp/mcp.json')).toBe('.junie/mcp/mcp.json');
  });

  it('suppresses .aiignore in global mode (returns null)', () => {
    expect(rewrite('.aiignore')).toBeNull();
  });

  it('returns unmodified path for unknown paths', () => {
    expect(rewrite('.junie/other/file.txt')).toBe('.junie/other/file.txt');
  });
});

describe('junie global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('junie', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .junie/skills/ to .agents/skills/', () => {
    expect(mirror('.junie/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .junie/skills/', () => {
    expect(mirror('.junie/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.junie/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for rule files (not mirrored)', () => {
    expect(mirror('.junie/AGENTS.md', [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror('.junie/commands/commit.md', [])).toBeNull();
  });

  it('returns null for agent files (not mirrored)', () => {
    expect(mirror('.junie/agents/reviewer.md', [])).toBeNull();
  });

  it('returns null for MCP file (not mirrored)', () => {
    expect(mirror('.junie/mcp/mcp.json', [])).toBeNull();
  });
});
