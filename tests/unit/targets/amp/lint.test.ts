import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintIgnore, lintHooks, lintPermissions } from '../../../../src/targets/amp/lint.js';

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

describe('lintPermissions (amp)', () => {
  it('returns empty when permissions is null', () => {
    expect(lintPermissions(makeCanonical({ permissions: null }))).toHaveLength(0);
  });

  it('returns empty when all permission lists are empty', () => {
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [], ask: [] } })),
    ).toHaveLength(0);
  });

  it('warns when allow list has entries', () => {
    const result = lintPermissions(
      makeCanonical({ permissions: { allow: ['npm run build'], deny: [], ask: [] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('amp');
    expect(result[0].message).toContain('legacy');
  });

  it('warns when deny list has entries', () => {
    const result = lintPermissions(
      makeCanonical({ permissions: { allow: [], deny: ['rm -rf'], ask: [] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('amp');
  });

  it('warns when ask list has entries', () => {
    const result = lintPermissions(
      makeCanonical({ permissions: { allow: [], deny: [], ask: ['Bash'] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('amp');
  });
});

describe('lintHooks (amp)', () => {
  it('returns empty when hooks is null', () => {
    expect(lintHooks(makeCanonical({ hooks: null }))).toHaveLength(0);
  });

  it('returns empty when hooks has no entries', () => {
    expect(lintHooks(makeCanonical({ hooks: { PreToolUse: [] } }))).toHaveLength(0);
  });

  it('warns when hooks entries exist', () => {
    const result = lintHooks(
      makeCanonical({ hooks: { PreToolUse: [{ matcher: '*', command: 'echo hi' }] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('amp');
    expect(result[0].message).toContain('amp.on');
  });
});
