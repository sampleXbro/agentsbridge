import { describe, expect, it } from 'vitest';
import type { CanonicalFiles } from '../../../src/core/types.js';
import { lintPermissions as lintCursorPermissions } from '../../../src/targets/cursor/lint.js';

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

describe('cursor lint.permissions hook', () => {
  it('returns no diagnostics when permissions are missing', () => {
    expect(lintCursorPermissions(makeCanonical(null))).toEqual([]);
  });

  it('returns no diagnostics when cursor permissions are empty', () => {
    expect(
      lintCursorPermissions(
        makeCanonical({
          allow: [],
          deny: [],
        }),
      ),
    ).toEqual([]);
  });

  it('warns when cursor permissions contain allow or deny entries', () => {
    const diagnostics = lintCursorPermissions(
      makeCanonical({
        allow: [],
        deny: ['Bash(rm -rf:*)'],
      }),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Cursor permissions are partial');
  });
});
