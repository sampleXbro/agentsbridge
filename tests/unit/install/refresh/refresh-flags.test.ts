import { describe, expect, it } from 'vitest';
import {
  parseRefreshNames,
  readRefreshFlags,
  type RefreshCommandResult,
} from '../../../../src/install/refresh/refresh-flags.js';
import type {
  FailedItem,
  FailurePhase,
  RefreshedItem,
  SkippedItem,
  UnchangedItem,
} from '../../../../src/install/refresh/refresh-result.js';

/**
 * Type-only smoke check: assert the Phase 3 vocabulary compiles correctly.
 * These assignments are never evaluated at runtime.
 */
function _typeChecks(): void {
  const _result: RefreshCommandResult = {
    exitCode: 0,
    data: {
      scope: 'project',
      mode: 'refresh',
      refreshed: [],
      unchanged: [],
      skipped: [],
      failed: [],
      dryRun: false,
    },
  };
  const _refreshed: RefreshedItem = {
    name: 'p',
    oldRef: null,
    newRef: 'main',
    oldSha: null,
    newSha: 'abc',
    changedFiles: { added: [], removed: [], modified: [] },
  };
  const _unchanged: UnchangedItem = { name: 'p', ref: 'main' };
  const _skipped: SkippedItem = { name: 'p', reason: 'user-declined' };
  const _phase: FailurePhase = 'plan';
  const _failed: FailedItem = { name: 'p', phase: _phase, error: 'oops' };
  void _result;
  void _refreshed;
  void _unchanged;
  void _skipped;
  void _failed;
}
void _typeChecks;

describe('readRefreshFlags', () => {
  it('defaults every flag to false', () => {
    expect(readRefreshFlags({})).toEqual({
      dryRun: false,
      force: false,
      global: false,
      json: false,
      verbose: false,
    });
  });

  it('maps --dry-run, --force, --json, --global, --verbose', () => {
    expect(
      readRefreshFlags({
        'dry-run': true,
        force: true,
        json: true,
        global: true,
        verbose: true,
      }),
    ).toEqual({
      dryRun: true,
      force: true,
      global: true,
      json: true,
      verbose: true,
    });
  });

  it('ignores unknown flags', () => {
    expect(readRefreshFlags({ unknown: true, name: 'x' })).toEqual({
      dryRun: false,
      force: false,
      global: false,
      json: false,
      verbose: false,
    });
  });
});

describe('parseRefreshNames', () => {
  it('returns empty array for no args', () => {
    expect(parseRefreshNames([])).toEqual([]);
  });

  it('splits a single comma-separated arg', () => {
    expect(parseRefreshNames(['a,b,c'])).toEqual(['a', 'b', 'c']);
  });

  it('handles whitespace and empty segments', () => {
    expect(parseRefreshNames(['  a , b ,, c '])).toEqual(['a', 'b', 'c']);
  });

  it('preserves duplicates so callers can detect them', () => {
    expect(parseRefreshNames(['a', 'a'])).toEqual(['a', 'a']);
  });

  it('combines multiple args', () => {
    expect(parseRefreshNames(['a,b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});
