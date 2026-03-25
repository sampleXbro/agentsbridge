import { describe, expect, it } from 'vitest';
import type { CanonicalFiles } from '../../../src/core/types.js';
import { lintPermissions } from '../../../src/core/linter-permissions.js';

function makeCanonical(permissions: CanonicalFiles['permissions']): CanonicalFiles {
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

describe('lintPermissions', () => {
  it('returns no diagnostics when permissions are missing', () => {
    expect(lintPermissions(makeCanonical(null), 'cursor')).toEqual([]);
  });

  it('returns no diagnostics for non-cursor targets', () => {
    expect(
      lintPermissions(
        makeCanonical({
          allow: ['Read'],
          deny: [],
        }),
        'claude-code',
      ),
    ).toEqual([]);
  });

  it('returns no diagnostics when cursor permissions are empty', () => {
    expect(
      lintPermissions(
        makeCanonical({
          allow: [],
          deny: [],
        }),
        'cursor',
      ),
    ).toEqual([]);
  });

  it('warns when cursor permissions contain allow or deny entries', () => {
    const diagnostics = lintPermissions(
      makeCanonical({
        allow: [],
        deny: ['Bash(rm -rf:*)'],
      }),
      'cursor',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Cursor permissions are partial');
  });
});
