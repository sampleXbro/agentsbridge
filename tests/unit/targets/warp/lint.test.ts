import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintHooks, lintPermissions, lintIgnore } from '../../../../src/targets/warp/lint.js';

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

describe('lintHooks (warp)', () => {
  it('returns warning when hooks exist', () => {
    const canonical = makeCanonical({
      hooks: { preCommit: [{ command: 'pnpm lint' }] },
    });

    const results = lintHooks(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('warp');
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

describe('lintPermissions (warp)', () => {
  it('returns warning when permissions exist at the default (project) scope', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [], ask: [] },
    });

    const results = lintPermissions(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('warp');
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

  it('names every entry with no settings.toml key at global scope', () => {
    const results = lintPermissions(
      makeCanonical({
        permissions: { allow: ['Bash', 'Edit(src/**)', 'Bash(ls)'], deny: ['Read(./.env)'] },
      }),
      { scope: 'global' },
    );

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('warp');
    expect(results[0].message).toContain('allow Bash, Edit(src/**)');
    expect(results[0].message).toContain('deny Read(./.env)');
  });

  it('stays silent at global scope when every entry maps', () => {
    const canonical = makeCanonical({ permissions: { allow: ['Bash(ls)'], deny: [] } });
    expect(lintPermissions(canonical, { scope: 'global' })).toHaveLength(0);
  });

  it('names Bash payloads Warp reads as regexes rather than literal commands', () => {
    const results = lintPermissions(
      makeCanonical({
        permissions: { allow: ['Bash(node build.js:*)'], deny: ['Bash(rm -rf .*)'] },
      }),
      { scope: 'global' },
    );

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].message).toContain('regex');
    expect(results[0].message).toContain('allow Bash(node build.js:*)');
    expect(results[0].message).toContain('deny Bash(rm -rf .*)');
  });

  it('names a Bash payload that is not a valid regex, because generation drops it', () => {
    const results = lintPermissions(
      makeCanonical({ permissions: { allow: ['Bash(echo :-))'], deny: [] } }),
      { scope: 'global' },
    );

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('allow Bash(echo :-))');
  });

  it('does not warn about ask entries, which Warp expresses by omission', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: ['Bash(git push:*)'] },
    });
    expect(lintPermissions(canonical, { scope: 'global' })).toHaveLength(0);
  });
});

describe('lintIgnore (warp)', () => {
  it('returns warning when ignore patterns exist at global scope', () => {
    const canonical = makeCanonical({
      ignore: ['node_modules', '.env'],
    });

    const results = lintIgnore(canonical, { scope: 'global' });

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('warp');
  });

  it('returns empty at the default (project) scope, which generates the file', () => {
    const canonical = makeCanonical({ ignore: ['node_modules', '.env'] });
    expect(lintIgnore(canonical)).toHaveLength(0);
  });

  it('returns empty when ignore is empty', () => {
    const canonical = makeCanonical({ ignore: [] });
    expect(lintIgnore(canonical, { scope: 'global' })).toHaveLength(0);
  });
});
