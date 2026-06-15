import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintIgnore } from '../../../../src/targets/amp/lint.js';

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

describe('lintIgnore (amp)', () => {
  it('returns empty when no ignore patterns', () => {
    expect(lintIgnore(makeCanonical())).toHaveLength(0);
  });

  it('warns when ignore patterns exist', () => {
    const result = lintIgnore(makeCanonical({ ignore: ['.env', 'node_modules/'] }));
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('amp');
  });
});
