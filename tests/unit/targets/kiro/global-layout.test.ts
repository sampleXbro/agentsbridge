import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('kiro global layout — paths', () => {
  const layout = getTargetLayout('kiro', 'global')!;

  it('resolves rule path to .kiro/steering/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.kiro/steering/typescript.md');
  });

  it('suppresses command path (returns null)', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBeNull();
  });

  it('resolves agent path to .kiro/agents/', () => {
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.kiro/agents/my-agent.md');
  });
});

describe('kiro global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('kiro', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites AGENTS.md to .kiro/steering/AGENTS.md', () => {
    expect(rewrite('AGENTS.md')).toBe('.kiro/steering/AGENTS.md');
  });

  it('keeps .kiro/steering/ rule paths unchanged', () => {
    expect(rewrite('.kiro/steering/typescript.md')).toBe('.kiro/steering/typescript.md');
  });

  it('keeps .kiro/skills/ paths unchanged', () => {
    expect(rewrite('.kiro/skills/ts-pro/SKILL.md')).toBe('.kiro/skills/ts-pro/SKILL.md');
  });

  it('keeps .kiro/agents/ paths unchanged', () => {
    expect(rewrite('.kiro/agents/my-agent.md')).toBe('.kiro/agents/my-agent.md');
  });

  it('keeps .kiro/settings/mcp.json unchanged', () => {
    expect(rewrite('.kiro/settings/mcp.json')).toBe('.kiro/settings/mcp.json');
  });

  it('suppresses .kiro/hooks/ in global mode (returns null)', () => {
    expect(rewrite('.kiro/hooks/pre-tool-use.json')).toBeNull();
  });

  it('rewrites .kiroignore to .kiro/settings/kiroignore', () => {
    expect(rewrite('.kiroignore')).toBe('.kiro/settings/kiroignore');
  });
});

describe('kiro global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('kiro', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .kiro/skills/ to .agents/skills/', () => {
    expect(mirror('.kiro/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .kiro/skills/', () => {
    expect(mirror('.kiro/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('returns null for steering files (not mirrored)', () => {
    expect(mirror('.kiro/steering/typescript.md', [])).toBeNull();
  });

  it('returns null for MCP file (not mirrored)', () => {
    expect(mirror('.kiro/mcp.json', [])).toBeNull();
  });
});
