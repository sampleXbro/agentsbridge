import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintPermissions } from '../../../../src/targets/antigravity/lint.js';

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

describe('lintPermissions (antigravity)', () => {
  it('returns [] when permissions is null', () => {
    expect(lintPermissions(makeCanonical())).toHaveLength(0);
  });

  it('returns [] when all permission lists are empty', () => {
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [], ask: [] } })),
    ).toHaveLength(0);
  });

  it('emits a warning when allow is non-empty', () => {
    const result = lintPermissions(
      makeCanonical({ permissions: { allow: ['npm run build'], deny: [], ask: [] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].message).toContain('Antigravity');
  });

  it('emits a warning when deny is non-empty', () => {
    const result = lintPermissions(
      makeCanonical({ permissions: { allow: [], deny: ['rm -rf'], ask: [] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
  });

  it('emits a warning when ask is non-empty', () => {
    const result = lintPermissions(
      makeCanonical({ permissions: { allow: [], deny: [], ask: ['git push'] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
  });

  it('sets target to antigravity', () => {
    const result = lintPermissions(
      makeCanonical({ permissions: { allow: ['npm run build'], deny: [], ask: [] } }),
    );
    expect(result[0].target).toBe('antigravity');
  });
});
