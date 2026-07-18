import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintHooks, lintPermissions } from '../../../../src/targets/junie/lint.js';

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

describe('lintHooks (junie)', () => {
  it('returns empty when hooks is null', () => {
    const canonical = makeCanonical({ hooks: null });
    expect(lintHooks(canonical)).toHaveLength(0);
  });

  it('returns empty when hooks has no entries', () => {
    const canonical = makeCanonical({
      hooks: { PreToolUse: [], PostToolUse: [] },
    });
    expect(lintHooks(canonical)).toHaveLength(0);
  });

  it('returns a warning when hooks have entries', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [{ matcher: 'shell', command: 'echo pre' }],
      },
    });

    const result = lintHooks(canonical);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('junie');
    expect(result[0].message).toContain('hook');
  });
});

describe('lintPermissions (junie)', () => {
  it('returns empty when permissions is null', () => {
    const canonical = makeCanonical({ permissions: null });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });

  it('returns empty when all permission lists are empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: [] },
    });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });

  it('returns a warning when allow list has entries', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [], ask: [] },
    });

    const result = lintPermissions(canonical);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('junie');
    expect(result[0].message).toContain('brave');
  });

  it('returns a warning when deny list has entries', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: ['Write'], ask: [] },
    });

    const result = lintPermissions(canonical);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
  });

  it('returns a warning when ask list has entries', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: ['Bash'] },
    });

    const result = lintPermissions(canonical);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
  });
});
