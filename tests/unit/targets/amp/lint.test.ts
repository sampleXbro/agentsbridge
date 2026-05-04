import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintHooks, lintPermissions, lintIgnore } from '../../../../src/targets/amp/lint.js';

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

describe('lintHooks (amp)', () => {
  it('returns empty when no hooks', () => {
    expect(lintHooks(makeCanonical())).toHaveLength(0);
  });

  it('returns empty when hooks object has empty arrays', () => {
    expect(lintHooks(makeCanonical({ hooks: { preGenerate: [], postGenerate: [] } }))).toHaveLength(
      0,
    );
  });

  it('warns when hooks have entries', () => {
    const result = lintHooks(
      makeCanonical({
        hooks: { preGenerate: [{ command: 'echo test' }] },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('amp');
  });
});

describe('lintPermissions (amp)', () => {
  it('returns empty when no permissions', () => {
    expect(lintPermissions(makeCanonical())).toHaveLength(0);
  });

  it('returns empty when permissions are all empty', () => {
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [], ask: [] } })),
    ).toHaveLength(0);
  });

  it('warns when permissions have entries', () => {
    const result = lintPermissions(
      makeCanonical({ permissions: { allow: ['Bash'], deny: [], ask: [] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('amp');
  });
});

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
