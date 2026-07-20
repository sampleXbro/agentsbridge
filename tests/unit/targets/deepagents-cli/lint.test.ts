import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  lintPermissions,
  lintIgnore,
  lintHooks,
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

describe('lintHooks (deepagents-cli)', () => {
  it('warns at project scope when hooks exist (no project-level surface)', () => {
    const canonical = makeCanonical({
      hooks: { PostToolUse: [{ matcher: '*', command: 'echo hi' }] },
    });
    const results = lintHooks(canonical, { scope: 'project' });
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('deepagents-cli');
  });

  it('warns at default scope (undefined treated as project)', () => {
    const canonical = makeCanonical({
      hooks: { PostToolUse: [{ matcher: '*', command: 'echo hi' }] },
    });
    expect(lintHooks(canonical)).toHaveLength(1);
  });

  it('returns empty at project scope when hooks is null', () => {
    expect(lintHooks(makeCanonical({ hooks: null }), { scope: 'project' })).toHaveLength(0);
  });

  it('returns empty at project scope when all hook arrays are empty', () => {
    const canonical = makeCanonical({ hooks: { PostToolUse: [] } });
    expect(lintHooks(canonical, { scope: 'project' })).toHaveLength(0);
  });

  it('returns empty at global scope for mapped events (SessionStart)', () => {
    const canonical = makeCanonical({
      hooks: { SessionStart: [{ matcher: '', command: 'echo hi' }] },
    });
    expect(lintHooks(canonical, { scope: 'global' })).toHaveLength(0);
  });

  it('warns at global scope about unmapped events (PreToolUse)', () => {
    const canonical = makeCanonical({
      hooks: { PreToolUse: [{ matcher: '*', command: 'echo hi' }] },
    });
    const results = lintHooks(canonical, { scope: 'global' });
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('PreToolUse');
  });

  it('returns empty at global scope when hooks is null', () => {
    expect(lintHooks(makeCanonical({ hooks: null }), { scope: 'global' })).toHaveLength(0);
  });
});
