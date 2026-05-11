import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  lintHooks,
  lintPermissions,
  lintIgnore,
} from '../../../../src/targets/deepagents-cli/lint.js';

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

describe('lintHooks (deepagents-cli)', () => {
  it('returns warning when hooks exist', () => {
    const canonical = makeCanonical({
      hooks: { preCommit: [{ command: 'pnpm lint' }] },
    });

    const results = lintHooks(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('deepagents-cli');
  });

  it('returns empty when hooks is null', () => {
    const canonical = makeCanonical({ hooks: null });
    expect(lintHooks(canonical)).toHaveLength(0);
  });

  it('returns empty when all hook arrays are empty', () => {
    const canonical = makeCanonical({ hooks: {} });
    expect(lintHooks(canonical)).toHaveLength(0);
  });
});

describe('lintPermissions (deepagents-cli)', () => {
  it('returns warning when permissions exist', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [], ask: [] },
    });

    const results = lintPermissions(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('deepagents-cli');
  });

  it('returns empty when permissions is null', () => {
    const canonical = makeCanonical({ permissions: null });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });

  it('returns empty when all permission arrays are empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: [] },
    });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });

  it('warns when permissions have entries but no ask field', () => {
    const result = lintPermissions(makeCanonical({ permissions: { allow: ['Bash'], deny: [] } }));
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('deepagents-cli');
  });
});

describe('lintIgnore (deepagents-cli)', () => {
  it('returns warning when ignore patterns exist', () => {
    const canonical = makeCanonical({
      ignore: ['node_modules', '.env'],
    });

    const results = lintIgnore(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('deepagents-cli');
  });

  it('returns empty when ignore is empty', () => {
    const canonical = makeCanonical({ ignore: [] });
    expect(lintIgnore(canonical)).toHaveLength(0);
  });
});
