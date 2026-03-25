import { describe, it, expect } from 'vitest';
import {
  toGlobsArray,
  toToolsArray,
  toStringArray,
  toStringRecord,
} from '../../../src/targets/shared-import-helpers.js';

describe('shared-import-helpers', () => {
  describe('toGlobsArray', () => {
    it('returns empty array for undefined', () => expect(toGlobsArray(undefined)).toEqual([]));
    it('returns empty array for null', () => expect(toGlobsArray(null)).toEqual([]));
    it('returns empty array for empty string', () => expect(toGlobsArray('')).toEqual([]));
    it('wraps non-empty string in array', () => expect(toGlobsArray('*.ts')).toEqual(['*.ts']));
    it('passes through string array', () =>
      expect(toGlobsArray(['*.ts', '*.js'])).toEqual(['*.ts', '*.js']));
    it('filters non-strings from array', () =>
      expect(toGlobsArray(['*.ts', 42, null])).toEqual(['*.ts']));
  });

  describe('toToolsArray', () => {
    it('returns empty array for undefined', () => expect(toToolsArray(undefined)).toEqual([]));
    it('splits comma-separated string', () =>
      expect(toToolsArray('a, b, c')).toEqual(['a', 'b', 'c']));
    it('trims whitespace from array items', () =>
      expect(toToolsArray([' a ', ' b '])).toEqual(['a', 'b']));
    it('filters empty strings', () => expect(toToolsArray(['a', '', 'b'])).toEqual(['a', 'b']));
    it('passes through string array', () => expect(toToolsArray(['a', 'b'])).toEqual(['a', 'b']));
  });

  describe('toStringArray', () => {
    it('returns empty array for undefined', () => expect(toStringArray(undefined)).toEqual([]));
    it('returns empty array for non-array', () => expect(toStringArray('foo')).toEqual([]));
    it('passes through string array', () => expect(toStringArray(['a', 'b'])).toEqual(['a', 'b']));
    it('filters non-strings from array', () =>
      expect(toStringArray(['a', 42, 'b'])).toEqual(['a', 'b']));
  });

  describe('toStringRecord', () => {
    it('returns empty object for undefined', () => expect(toStringRecord(undefined)).toEqual({}));
    it('returns empty object for array', () => expect(toStringRecord(['a'])).toEqual({}));
    it('passes through string-valued object', () =>
      expect(toStringRecord({ a: 'b' })).toEqual({ a: 'b' }));
    it('filters non-string values', () =>
      expect(toStringRecord({ a: 'b', c: 42 })).toEqual({ a: 'b' }));
  });
});
