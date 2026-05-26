import { describe, expect, it } from 'vitest';
import {
  parseRefreshNames,
  readRefreshFlags,
} from '../../../../src/install/refresh/refresh-flags.js';

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
