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

/**
 * Cursor permissions capability is 'native' (both project and global scope).
 * generatePermissions writes .cursor/cli.json (project) or ~/.cursor/cli-config.json (global).
 * lintPermissions must return no diagnostics — emitting a stale 'partial' warning would
 * contradict the native capability declaration.
 */
describe('cursor lint.permissions hook', () => {
  it('returns no diagnostics when permissions are missing', () => {
    expect(lintCursorPermissions(makeCanonical(null))).toEqual([]);
  });

  it('returns no diagnostics when permissions are empty', () => {
    expect(
      lintCursorPermissions(
        makeCanonical({
          allow: [],
          deny: [],
        }),
      ),
    ).toEqual([]);
  });

  it('returns no diagnostics even when allow and deny entries are present (native capability)', () => {
    const diagnostics = lintCursorPermissions(
      makeCanonical({
        allow: ['Read', 'Grep'],
        deny: ['Bash(rm -rf:*)'],
      }),
    );
    expect(diagnostics).toHaveLength(0);
  });

  it('returns no diagnostics when only deny entries are present', () => {
    expect(lintCursorPermissions(makeCanonical({ allow: [], deny: ['WebFetch'] }))).toHaveLength(0);
  });
});
