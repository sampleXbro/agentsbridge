import { describe, expect, it } from 'vitest';
import { numberFlag, repeatedFlag } from '../../../../src/cli/commands/lessons-helpers.js';

describe('numberFlag', () => {
  it('parses a valid numeric string', () => {
    expect(numberFlag({ n: '5' }, 'n')).toBe(5);
  });
  it('returns null for a non-numeric string', () => {
    expect(numberFlag({ n: 'wat' }, 'n')).toBeNull();
  });
  it('returns null when absent', () => {
    expect(numberFlag({}, 'n')).toBeNull();
  });
  it('returns null for boolean or array values', () => {
    expect(numberFlag({ n: true }, 'n')).toBeNull();
    expect(numberFlag({ n: ['1'] }, 'n')).toBeNull();
  });
});

describe('repeatedFlag', () => {
  it('returns an array as-is, dropping empties', () => {
    expect(repeatedFlag({ f: ['a', 'b', ''] }, 'f')).toEqual(['a', 'b']);
  });
  it('wraps a single string in an array', () => {
    expect(repeatedFlag({ f: 'a' }, 'f')).toEqual(['a']);
  });
  it('returns [] for absent or boolean values', () => {
    expect(repeatedFlag({}, 'f')).toEqual([]);
    expect(repeatedFlag({ f: true }, 'f')).toEqual([]);
  });
  it('returns [] for an empty string', () => {
    expect(repeatedFlag({ f: '' }, 'f')).toEqual([]);
  });
});
