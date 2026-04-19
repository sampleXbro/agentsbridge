import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('cline global layout — paths', () => {
  const layout = getTargetLayout('cline', 'global')!;

  it('resolves rule path to Documents/Cline/Rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('Documents/Cline/Rules/typescript.md');
  });

  it('resolves command path to Documents/Cline/Workflows/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      'Documents/Cline/Workflows/deploy.md',
    );
  });

  it('resolves agent path to .cline/skills/ (embedded as skill)', () => {
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
        conversions: { agents_to_skills: { cline: true } },
      }),
    ).toBe('.cline/skills/am-agent-my-agent/SKILL.md');
  });
});

describe('cline global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('cline', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('suppresses AGENTS.md in global mode (returns null)', () => {
    expect(rewrite('AGENTS.md')).toBeNull();
  });

  it('rewrites .clinerules/workflows/ to Documents/Cline/Workflows/', () => {
    expect(rewrite('.clinerules/workflows/deploy.md')).toBe('Documents/Cline/Workflows/deploy.md');
  });

  it('rewrites .clinerules/ rules to Documents/Cline/Rules/', () => {
    expect(rewrite('.clinerules/typescript.md')).toBe('Documents/Cline/Rules/typescript.md');
  });

  it('keeps .cline/skills/ paths unchanged', () => {
    expect(rewrite('.cline/skills/ts-pro/SKILL.md')).toBe('.cline/skills/ts-pro/SKILL.md');
  });

  it('keeps .cline/cline_mcp_settings.json unchanged', () => {
    expect(rewrite('.cline/cline_mcp_settings.json')).toBe('.cline/cline_mcp_settings.json');
  });

  it('keeps .clineignore unchanged', () => {
    expect(rewrite('.clineignore')).toBe('.clineignore');
  });
});

describe('cline global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('cline', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .cline/skills/ to .agents/skills/', () => {
    expect(mirror('.cline/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .cline/skills/', () => {
    expect(mirror('.cline/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror('AGENTS.md', [])).toBeNull();
  });

  it('returns null for workflow files (not mirrored)', () => {
    expect(mirror('Documents/Cline/Workflows/commit.md', [])).toBeNull();
  });
});
