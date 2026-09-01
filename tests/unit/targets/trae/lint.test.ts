import { describe, it, expect } from 'vitest';
import type { CanonicalFiles, Permissions } from '../../../../src/core/types.js';
import { lintPermissions } from '../../../../src/targets/trae/lint.js';

function makeCanonical(permissions: Permissions | null): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions,
    hooks: null,
    ignore: [],
  };
}

describe('lintPermissions (trae)', () => {
  it('returns empty when there are no permissions', () => {
    expect(lintPermissions(makeCanonical(null), { scope: 'global' })).toHaveLength(0);
    expect(
      lintPermissions(makeCanonical({ allow: [], deny: [], ask: [] }), { scope: 'global' }),
    ).toHaveLength(0);
  });

  it('returns empty when permissions carries no ask property', () => {
    expect(
      lintPermissions(makeCanonical({ allow: [], deny: [] }), { scope: 'global' }),
    ).toHaveLength(0);
  });

  it('warns that project scope has no permission file at all', () => {
    const result = lintPermissions(makeCanonical({ allow: ['Bash(ls:*)'], deny: [] }));

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('trae');
    expect(result[0].file).toBe('.agentsmesh/permissions.yaml');
    expect(result[0].message).toContain('~/.trae/permission/global.json');
  });

  it('warns in project scope even when every entry maps in global scope', () => {
    const result = lintPermissions(makeCanonical({ allow: ['Bash(ls:*)'], deny: [] }), {
      scope: 'project',
    });
    expect(result).toHaveLength(1);
  });

  it('names every global-scope entry Trae cannot express', () => {
    const result = lintPermissions(
      makeCanonical({
        allow: ['Read', 'Bash(ls:*)', 'Read(./docs)'],
        deny: ['Read(./.env)'],
        ask: ['WebFetch'],
      }),
      { scope: 'global' },
    );

    expect(result).toHaveLength(2);
    expect(result[0].message).toContain('allow Read');
    expect(result[0].message).toContain('deny Read(./.env)');
    expect(result[0].message).toContain('ask WebFetch');
    expect(result[0].message).not.toContain('Bash(ls:*)');
  });

  it('names the entries it adds to global.json but can never revoke', () => {
    const result = lintPermissions(
      makeCanonical({ allow: ['Bash(ls:*)', 'Edit(./src)'], deny: [] }),
      { scope: 'global' },
    );

    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('does NOT');
    expect(result[0].message).toContain('allow Bash(ls:*), Edit(./src)');
  });

  it('only names the dropped entries when nothing maps at all', () => {
    const result = lintPermissions(makeCanonical({ allow: ['Grep'], deny: [] }), {
      scope: 'global',
    });

    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('not projected: allow Grep');
  });

  it('stays silent in global scope when nothing maps and nothing is dropped', () => {
    expect(
      lintPermissions(makeCanonical({ allow: [], deny: [], ask: [] }), { scope: 'global' }),
    ).toHaveLength(0);
  });
});
