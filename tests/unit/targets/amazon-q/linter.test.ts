import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintRules } from '../../../../src/targets/amazon-q/linter.js';

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

describe('lintRules (amazon-q)', () => {
  it('returns empty diagnostics for empty rules', () => {
    const canonical = makeCanonical({ rules: [] });
    const result = lintRules(canonical, '/proj', []);
    expect(result).toHaveLength(0);
  });

  it('returns error when rules exist but no root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript',
          globs: [],
          body: 'Use strict TypeScript.',
        },
      ],
    });

    const result = lintRules(canonical, '/proj', []);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].level).toBe('error');
    expect(result[0].target).toBe('amazon-q');
  });

  it('sets target to amazon-q on all diagnostics', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: '',
          globs: ['src/**/*.ts'],
          body: 'body',
        },
      ],
    });

    const result = lintRules(canonical, '/proj', []);
    for (const d of result) {
      expect(d.target).toBe('amazon-q');
    }
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
          source: '/proj/.agentsmesh/rules/unmatched.md',
          root: false,
          targets: [],
          description: '',
          globs: ['nonexistent/**/*.xyz'],
          body: 'body',
        },
      ],
    });

    const globalResult = lintRules(canonical, '/proj', [], { scope: 'global' });
    expect(globalResult).toHaveLength(0);
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
          source: '/proj/.agentsmesh/rules/unmatched.md',
          root: false,
          targets: [],
          description: '',
          globs: ['nonexistent/**/*.xyz'],
          body: 'body',
        },
      ],
    });

    const projectResult = lintRules(canonical, '/proj', ['src/index.ts'], {
      scope: 'project',
    });
    expect(projectResult.length).toBeGreaterThan(0);
    expect(projectResult.some((d) => d.level === 'warning')).toBe(true);
  });

  it('checks glob matches when scope is not specified (defaults to project)', () => {
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
          source: '/proj/.agentsmesh/rules/unmatched.md',
          root: false,
          targets: [],
          description: '',
          globs: ['nonexistent/**/*.xyz'],
          body: 'body',
        },
      ],
    });

    const result = lintRules(canonical, '/proj', ['src/index.ts']);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((d) => d.level === 'warning')).toBe(true);
  });
});
