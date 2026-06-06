import { describe, expect, it } from 'vitest';
import { getSafeCommandRegex, isSafeRegexPattern } from '../../../src/lessons/regex-safety.js';

describe('isSafeRegexPattern (fail-closed linear subset)', () => {
  // Accepted: the provably-linear subset. Includes every real-graph pattern
  // shape so the validation error never bricks existing command_pattern triggers.
  it.each([
    'git commit',
    'pnpm test:coverage',
    'install https?://',
    'sed.*SKILL.md',
    '^pnpm test:e2e',
    '(npm|pnpm) root -g', // unquantified alternation group
    '(?:abc)d', // unquantified non-capturing group
    '(?<name>abc)d', // unquantified named group
    "<<'EOF'",
    'node ./dist/cli.js',
    '.*foo.*', // two repetitions separated by a required literal — linear
    'rg -n.*src/index\\.ts|rg -n.*src/lessons\\.ts', // repetitions in different branches
    'https?://example\\.com/.*',
    'a?b?', // optional atoms, no repetition
    '[a-z]+/[a-z]+', // repetitions separated by a required literal
    'a+ba+', // repetitions separated by a required atom
    'a{2,5}', // single bounded quantifier
    'a{2}b',
    '(ab)?c', // optional (non-repeating) group is transparent
    '[\\d]+x', // char class containing an escape, single repetition
    'a{2,5}?', // lazy bounded quantifier
    'a*?b', // lazy star, single repetition
  ])('accepts linear pattern %j', (pattern) => {
    expect(isSafeRegexPattern(pattern)).toBe(true);
  });

  // Rejected: everything outside the linear subset (fail closed).
  it.each([
    // Reviewer-reported bypasses of the old heuristic:
    '(a|aa)+$',
    '(a|a?)+$',
    'a+a+$',
    // Nested repetition / quantified groups:
    '(a+)+$',
    '(a+)+',
    '(a*)*',
    '(\\w+)*',
    '([a-z]+)+',
    '(.*)*',
    '(a{2,})+',
    '(?:abc)+', // quantified non-capturing group
    '(?<name>abc)+', // quantified named group
    '(abc)+',
    // Adjacent repetition (transparent across groups / optionals):
    '.*.*',
    '\\w+\\w+',
    '(a+)(a+)$',
    'a+b?a+',
    'a+[bc]+', // repetition then an adjacent repeated char class
    '((\\w+))+',
    // Backtracking-only features (RE2-class engines forbid these):
    '(a)\\1',
    '\\k<n>x',
    '(?=foo)bar',
    '(?!foo)bar',
    '(?<=foo)bar',
    '(?<!foo)bar',
  ])('rejects non-linear pattern %j', (pattern) => {
    expect(isSafeRegexPattern(pattern)).toBe(false);
  });

  it('rejects an over-long pattern', () => {
    expect(isSafeRegexPattern('a'.repeat(1001))).toBe(false);
  });

  it('the detector itself is cheap on adversarial patterns', () => {
    expect(isSafeRegexPattern('(a+)+(b+)+(c+)+$')).toBe(false);
  });
});

describe('getSafeCommandRegex', () => {
  it('returns a working RegExp for an accepted pattern', () => {
    const re = getSafeCommandRegex('git\\s+commit');
    expect(re).toBeInstanceOf(RegExp);
    expect(re?.test('git   commit')).toBe(true);
    expect(re?.test('git status')).toBe(false);
  });

  it('returns null for a non-linear pattern (recall never executes it)', () => {
    expect(getSafeCommandRegex('(a|aa)+$')).toBeNull();
    expect(getSafeCommandRegex('a+a+$')).toBeNull();
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

  it('memoizes the null result for a rejected pattern', () => {
    expect(getSafeCommandRegex('(a+)+x')).toBeNull();
    expect(getSafeCommandRegex('(a+)+x')).toBeNull(); // second call hits the cached null
  });
});
