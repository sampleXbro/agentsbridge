import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintRules } from '../../../../src/targets/qwen-code/linter.js';

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

describe('lintRules (qwen-code)', () => {
  it('returns empty diagnostics for empty rules', () => {
    const result = lintRules(makeCanonical(), '/proj', []);
    expect(result).toHaveLength(0);
  });

  it('sets target to qwen-code on all diagnostics', () => {
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
      expect(d.target).toBe('qwen-code');
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
});
