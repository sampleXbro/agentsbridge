import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintRules } from '../../../../src/targets/trae/linter.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('lintRules (trae)', () => {
  it('returns no diagnostics for valid rules', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
      ],
    });

    const diags = lintRules(canonical, '/proj', [], { scope: 'project' });

    expect(diags).toHaveLength(0);
  });

  it('checks glob matches in project scope', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsmesh/rules/ts.md',
          root: false,
          targets: [],
          description: '',
          globs: ['src/**/*.ts'],
          body: 'TypeScript rules.',
        },
      ],
    });

    const diags = lintRules(canonical, '/proj', ['README.md'], { scope: 'project' });

    expect(diags.length).toBeGreaterThanOrEqual(1);
    const globWarning = diags.find((d) => d.message.includes('match 0 files'));
    expect(globWarning).toBeDefined();
    expect(globWarning?.target).toBe('trae');
  });

  it('skips glob matching in global scope', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsmesh/rules/ts.md',
          root: false,
          targets: [],
          description: '',
          globs: ['src/**/*.ts'],
          body: 'TypeScript rules.',
        },
      ],
    });

    const diags = lintRules(canonical, '/proj', [], { scope: 'global' });

    const globWarning = diags.find((d) => d.message.includes('match 0 files'));
    expect(globWarning).toBeUndefined();
  });

  it('defaults to project scope when no options passed', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsmesh/rules/ts.md',
          root: false,
          targets: [],
          description: '',
          globs: ['src/**/*.ts'],
          body: 'TypeScript rules.',
        },
      ],
    });

    const diags = lintRules(canonical, '/proj', ['README.md']);

    const globWarning = diags.find((d) => d.message.includes('match 0 files'));
    expect(globWarning).toBeDefined();
    expect(globWarning?.target).toBe('trae');
  });

  it('sets target to trae on all diagnostics', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/orphan.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'No root rule here.',
        },
      ],
    });

    const diags = lintRules(canonical, '/proj', [], { scope: 'project' });

    expect(diags.length).toBeGreaterThanOrEqual(1);
    for (const d of diags) {
      expect(d.target).toBe('trae');
    }
  });

  it('returns empty diagnostics for empty rules', () => {
    const diags = lintRules(makeCanonical(), '/proj', [], { scope: 'project' });
    expect(diags).toHaveLength(0);
  });
});
