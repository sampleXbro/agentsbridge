import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintPermissions } from '../../../../src/targets/roo-code/lint.js';

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

describe('lintPermissions (roo-code)', () => {
  it('returns warning when permissions exist', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [], ask: [] },
    });
    const results = lintPermissions(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
  });

  it('returns empty when permissions is null', () => {
    expect(lintPermissions(makeCanonical())).toHaveLength(0);
  });

  it('returns empty when all permission arrays are empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: [] },
    });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });

  it('warns when permissions are set but the ask key is omitted', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [] },
    });
    const results = lintPermissions(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
  });

  it('returns empty when only an omitted ask and empty allow/deny are present', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [] },
    });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });
});
