import { describe, expect, it } from 'vitest';
import { getSafeCommandRegex, isSafeRegexPattern } from '../../../src/lessons/regex-safety.js';

describe('isSafeRegexPattern', () => {
  // Patterns drawn from the real lessons graph — all must stay safe so the new
  // validation error never bricks existing command_pattern triggers.
  it.each([
    'git commit',
    'pnpm test:coverage',
    'install https?://',
    'sed.*SKILL.md',
    '^pnpm test:e2e',
    '(npm|pnpm) root -g',
    '<<EOF',
    "<<'EOF'",
    'node ./dist/cli.js',
    '.*foo.*',
    '(?:abc)+',
    '(a|b)+',
    'a{2,5}',
    'https?://example\\.com/.*',
  ])('treats linear pattern %j as safe', (pattern) => {
    expect(isSafeRegexPattern(pattern)).toBe(true);
  });

  // Catastrophic-backtracking family (star height >= 2).
  it.each([
    '(a+)+$',
    '(a+)+',
    '(a*)*',
    '(\\w+)*',
    '([a-z]+)+',
    '(\\d+)*\\d+',
    '((\\w+))+',
    '(.*)*',
    '(a{2,})+',
  ])('treats nested-repetition pattern %j as unsafe', (pattern) => {
    expect(isSafeRegexPattern(pattern)).toBe(false);
  });

  it('treats an over-long pattern as unsafe', () => {
    expect(isSafeRegexPattern('a'.repeat(1001))).toBe(false);
  });

  it('does not hang and reports unsafe for the classic ReDoS pattern', () => {
    // The detector itself must be cheap regardless of how evil the pattern is.
    expect(isSafeRegexPattern('(a+)+(b+)+(c+)+$')).toBe(false);
  });

  // Group-prefix forms must all parse as ordinary groups (no false positives).
  it.each([
    '(?=foo)bar', // lookahead
    '(?!foo)bar', // negative lookahead
    '(?<=foo)bar', // lookbehind
    '(?<!foo)bar', // negative lookbehind
    '(?<name>ab)+', // named capture, repeated (safe)
    '(?:ab)+', // non-capturing, repeated (safe)
  ])('treats group-prefix pattern %j as safe', (pattern) => {
    expect(isSafeRegexPattern(pattern)).toBe(true);
  });

  it('flags nested repetition inside a non-capturing group as unsafe', () => {
    expect(isSafeRegexPattern('(?:\\w+)+')).toBe(false);
  });

  // Quantifier variants: lazy and brace forms.
  it.each(['a+?', 'a*?', 'a{2,}?', 'a{2}', 'a{x}b'])(
    'treats single-quantifier pattern %j as safe',
    (pattern) => {
      expect(isSafeRegexPattern(pattern)).toBe(true);
    },
  );

  it.each(['(a+?)+', '(a{2,})+?'])(
    'treats nested lazy/brace repetition %j as unsafe',
    (pattern) => {
      expect(isSafeRegexPattern(pattern)).toBe(false);
    },
  );

  it('handles a character class containing an escaped bracket', () => {
    expect(isSafeRegexPattern('[\\]]+')).toBe(true);
    expect(isSafeRegexPattern('([\\]]+)+')).toBe(false);
  });

  it('does not crash on an unbalanced close paren (defers to the validity gate)', () => {
    expect(isSafeRegexPattern('abc)')).toBe(true); // structurally "safe"; invalid regex caught elsewhere
  });
});

describe('getSafeCommandRegex', () => {
  it('returns a working RegExp for a safe pattern', () => {
    const re = getSafeCommandRegex('git\\s+commit');
    expect(re).toBeInstanceOf(RegExp);
    expect(re?.test('git   commit')).toBe(true);
    expect(re?.test('git status')).toBe(false);
  });

  it('returns null for a ReDoS-unsafe pattern (never executed by recall)', () => {
    expect(getSafeCommandRegex('(a+)+$')).toBeNull();
  });

  it('returns null for an invalid regex', () => {
    expect(getSafeCommandRegex('(')).toBeNull();
  });

  it('memoizes — repeated calls return the same compiled instance', () => {
    const a = getSafeCommandRegex('memo-test-pattern');
    const b = getSafeCommandRegex('memo-test-pattern');
    expect(a).toBe(b);
  });
});
