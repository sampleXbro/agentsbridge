import { describe, expect, it } from 'vitest';
import { compileLinearMatcher } from '../../../src/lessons/regex-linear/index.js';

/**
 * The linear engine must agree with JS `RegExp.test` on the supported subset,
 * and stay linear (fast) on inputs that make a backtracking engine blow up.
 */

// Supported-subset patterns paired with inputs that exercise match / non-match.
const EQUIVALENCE: Array<{ pattern: string; inputs: string[] }> = [
  { pattern: 'git commit', inputs: ['git commit -m x', 'git status', 'do git commit now', ''] },
  { pattern: '^pnpm test:e2e', inputs: ['pnpm test:e2e', 'run pnpm test:e2e', 'pnpm test'] },
  { pattern: '^pnpm test$', inputs: ['pnpm test', 'pnpm test --watch', ' pnpm test'] },
  { pattern: '(npm|pnpm) root -g', inputs: ['npm root -g', 'pnpm root -g', 'yarn root -g'] },
  { pattern: 'https?://', inputs: ['http://x', 'https://x', 'ftp://x', 'see https://y'] },
  { pattern: 'sed.*SKILL\\.md', inputs: ['sed -i x SKILL.md', 'sed SKILLxmd', 'SKILL.md'] },
  {
    pattern: 'rg -n.*src/index\\.ts|rg -n.*src/lessons\\.ts',
    inputs: ['rg -n foo src/index.ts', 'rg -n x src/lessons.ts', 'rg src/other.ts'],
  },
  { pattern: '[a-z]+/[a-z]+', inputs: ['src/lib', 'ABC/DEF', 'a/b', 'nope'] },
  { pattern: '\\d{2,4}-\\d+', inputs: ['12-3', '1-3', '12345-6', '99-100'] },
  { pattern: 'a+b', inputs: ['aaab', 'b', 'aaa', 'xab'] },
  { pattern: '(a+)+$', inputs: ['aaa', 'aaab', ''] },
  { pattern: '(a|aa)+$', inputs: ['aaaa', 'aaab', 'a'] },
  { pattern: 'a+a+$', inputs: ['aa', 'a', 'aaa'] },
  { pattern: 'colou?r', inputs: ['color', 'colour', 'colouur'] },
  { pattern: 'foo\\b', inputs: ['foo', 'foobar', 'a foo b'] },
  { pattern: '\\bword\\b', inputs: ['a word b', 'wordy', 'sword'] },
  { pattern: '[^x]+y', inputs: ['aay', 'xy', 'y'] },
  { pattern: 'g(re|ar)y', inputs: ['grey', 'gary', 'gry'] },
  { pattern: 'a{3}', inputs: ['aaa', 'aa', 'aaaa'] },
  { pattern: 'a{2,}b', inputs: ['aab', 'ab', 'aaaab'] },
  { pattern: 'a{0,2}c', inputs: ['c', 'ac', 'aac', 'aaac'] },
  // Escape literals (control chars) and class escapes:
  { pattern: 'x\\ty', inputs: ['x\ty', 'x y'] },
  { pattern: 'a\\nb', inputs: ['a\nb', 'ab'] },
  { pattern: '\\r\\f\\v', inputs: ['\r\f\v', 'rfv'] },
  { pattern: '\\D+', inputs: ['abc', '123', 'a1'] },
  { pattern: '\\W', inputs: ['!', 'a', ' '] },
  { pattern: '\\S+', inputs: ['abc', '   ', ' a '] },
  // Char-class shapes: escape inside, negation, literal dash, leading ']':
  { pattern: '[\\d]+', inputs: ['12', 'ab', '1a'] },
  { pattern: '[^a-z]+', inputs: ['ABC', 'abc', 'A1'] },
  { pattern: '[a\\-z]+', inputs: ['a-z', 'b', '-'] },
  { pattern: '[]]', inputs: [']', 'x'] },
  // Group prefixes (non-capturing, named) — unquantified and quantified:
  { pattern: '(?:ab)c', inputs: ['abc', 'ac'] },
  { pattern: '(?<name>ab)+c', inputs: ['ababc', 'c', 'abc'] },
  // Lazy quantifiers (same match-existence as greedy for boolean search):
  { pattern: 'a*?b', inputs: ['b', 'aaab', 'a'] },
  { pattern: 'a+?b', inputs: ['ab', 'b'] },
  { pattern: 'a??b', inputs: ['b', 'ab'] },
  { pattern: 'a{1,3}?b', inputs: ['ab', 'aaab', 'b'] },
  // `.` excludes newline (matching RegExp), and an empty alternation branch:
  { pattern: 'a.b', inputs: ['axb', 'a\nb', 'ab'] },
  { pattern: 'x|', inputs: ['x', '', 'y'] },
  // Remaining engine branches: \w class, \0 literal, \B assertion, escaped
  // range-high, and a {0} repeat (expands to empty):
  { pattern: '\\w+', inputs: ['abc_1', '   ', '!a!'] },
  { pattern: 'a\\0b', inputs: ['a\0b', 'ab'] },
  { pattern: '\\Bx', inputs: ['ax', 'x', ' x', 'axb'] },
  { pattern: '[\\.-\\/]+', inputs: ['./', 'a', '/.'] },
  { pattern: 'a{0}b', inputs: ['b', 'ab', 'c'] },
  // Hex / unicode escapes decode to the right char (matching `new RegExp` w/o u flag):
  { pattern: '\\x61', inputs: ['a', 'x61', 'x', 'ba'] },
  { pattern: '\\u0061', inputs: ['a', 'u0061', 'A'] },
  { pattern: '[\\x61-\\x63]+', inputs: ['abc', 'ABC', 'a1'] },
  // `\b` INSIDE a class is a backspace (U+0008), not a word boundary:
  { pattern: '[\\b]', inputs: ['\b', 'b', ''] },
  // `\xZZ` is not valid hex → literal `x` then `ZZ` (RegExp w/o u flag agrees):
  { pattern: '\\xZZ', inputs: ['xZZ', 'a'] },
  // A long ε-chain (accepted, just under the state cap): the iterative closure
  // must not overflow the call stack (a recursive walk would).
  { pattern: '(){900}', inputs: ['x', ''] },
  // `.` excludes ALL line terminators (\n \r \u2028 \u2029), not just \n:
  { pattern: 'a.b', inputs: ['axb', 'a\rb', 'a\u2028b', 'a\u2029b', 'a\nb'] },
  // `$` follows no-`m` semantics: end of input only (not before a final newline):
  { pattern: 'x$', inputs: ['x', 'x\n', 'xy', 'ax'] },
  // `\cX` control escapes:
  { pattern: '\\cA', inputs: ['\x01', 'cA', ''] },
  { pattern: '\\cZ', inputs: ['\x1a', 'cZ'] },
];

describe('linear engine — equivalence with RegExp on the supported subset', () => {
  for (const { pattern, inputs } of EQUIVALENCE) {
    it(`matches RegExp for ${JSON.stringify(pattern)}`, () => {
      const matcher = compileLinearMatcher(pattern);
      expect(matcher).not.toBeNull();
      const re = new RegExp(pattern);
      for (const input of inputs) {
        expect(matcher!.test(input)).toBe(re.test(input));
      }
    });
  }
});

describe('linear engine — rejects what it cannot evaluate (fail closed)', () => {
  it.each([
    '(a)\\1', // backreference
    '\\k<n>x', // named backreference
    '(?=foo)bar', // lookahead
    '(?!foo)bar',
    '(?<=foo)bar', // lookbehind
    '(?<!foo)bar',
    '(', // unbalanced group
    'a)b', // stray close paren
    '*abc', // quantifier with nothing to repeat
    'a\\', // trailing backslash
    'a{1,100000}', // repeat over the engine's bound
    '[a-z', // unterminated class
    '(){1000}'.repeat(5), // P1a: would overflow a recursive ε-closure — rejected by the state cap
    'a{1000}'.repeat(10), // P1b: NFA state amplification — rejected by the state cap
    '\\c1', // \c not followed by a letter — rejected rather than diverge from RegExp
  ])('returns null for %j', (pattern) => {
    expect(compileLinearMatcher(pattern)).toBeNull();
  });
});

describe('linear engine — stays linear on adversarial input', () => {
  const fast = (pattern: string, input: string): number => {
    const m = compileLinearMatcher(pattern);
    expect(m).not.toBeNull();
    const start = Date.now();
    m!.test(input);
    return Date.now() - start;
  };

  it('a+b on 30k non-matching chars (quadratic for RegExp) is fast', () => {
    expect(fast('a+b', 'a'.repeat(30_000))).toBeLessThan(500);
  });

  it('nested/overlapping quantifiers on adversarial input are fast', () => {
    expect(fast('(a+)+$', 'a'.repeat(60) + '!')).toBeLessThan(500);
    expect(fast('(a|aa)+$', 'a'.repeat(60) + '!')).toBeLessThan(500);
    expect(fast('a+a+$', 'a'.repeat(60) + '!')).toBeLessThan(500);
  });

  it('many separated wildcards (polynomial for RegExp) is fast', () => {
    expect(fast('.*x.*x.*x.*x.*x.*x$', 'x'.repeat(5_000))).toBeLessThan(500);
  });

  it('memoizes compiled matchers', () => {
    expect(compileLinearMatcher('memo-linear')).toBe(compileLinearMatcher('memo-linear'));
  });

  it('a shared work budget bounds total work across calls (query-wide)', () => {
    // A near-cap pattern on a huge input would dominate; the budget caps it.
    const m = compileLinearMatcher('a{999}b');
    expect(m).not.toBeNull();
    const budget = { remaining: 50_000 };
    const start = Date.now();
    m!.test('a'.repeat(30_000), budget);
    expect(Date.now() - start).toBeLessThan(500);
    expect(budget.remaining).toBeLessThanOrEqual(0); // budget consumed, work bounded

    // A second matcher sharing the now-exhausted budget short-circuits to false
    // (this is how a query bounds total work across all its triggers).
    const m2 = compileLinearMatcher('git commit');
    expect(m2!.test('git commit', budget)).toBe(false);
  });
});
