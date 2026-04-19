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
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.junie/agents/my-agent.md');
  });
});

describe('junie global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('junie', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .junie/AGENTS.md unchanged (already in global form)', () => {
    expect(rewrite('.junie/AGENTS.md')).toBe('.junie/AGENTS.md');
  });

  it('keeps .junie/commands/ paths unchanged', () => {
    expect(rewrite('.junie/commands/deploy.md')).toBe('.junie/commands/deploy.md');
  });

  it('keeps .junie/skills/ paths unchanged', () => {
    expect(rewrite('.junie/skills/ts-pro/SKILL.md')).toBe('.junie/skills/ts-pro/SKILL.md');
  });

  it('keeps .junie/agents/ paths unchanged', () => {
    expect(rewrite('.junie/agents/my-agent.md')).toBe('.junie/agents/my-agent.md');
  });

  it('rewrites .junie/mcp/mcp.json unchanged (already in global form)', () => {
    expect(rewrite('.junie/mcp/mcp.json')).toBe('.junie/mcp/mcp.json');
  });

  it('suppresses .aiignore in global mode (returns null)', () => {
    expect(rewrite('.aiignore')).toBeNull();
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

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror('.junie/AGENTS.md', [])).toBeNull();
  });

  it('returns null for prompt files (not mirrored)', () => {
    expect(mirror('.junie/prompts/commit.md', [])).toBeNull();
  });
});
