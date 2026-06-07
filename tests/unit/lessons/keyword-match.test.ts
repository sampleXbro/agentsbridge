import { describe, expect, it } from 'vitest';
import { keywordMatches } from '../../../src/lessons/keyword-match.js';

describe('keywordMatches — explicit --keyword (unchanged behavior)', () => {
  it('matches a substring of the explicit keyword, case-insensitively', () => {
    expect(keywordMatches('windows', { keyword: 'Windows path bug' })).toBe(true);
    expect(keywordMatches('linux', { keyword: 'Windows path bug' })).toBe(false);
  });

  it('does not match when no field is supplied', () => {
    expect(keywordMatches('windows', {})).toBe(false);
  });
});

describe('keywordMatches — derived from file path + command (new)', () => {
  it('fires a keyword on a matching file-path token', () => {
    expect(keywordMatches('subagent', { file: 'src/agents/subagent-runner.ts' })).toBe(true);
  });

  it('fires a keyword on a matching command token', () => {
    expect(keywordMatches('checkout', { command: 'git checkout -b feature' })).toBe(true);
  });

  it('matches on token boundaries, not substrings — "cat" does not fire on "category.ts"', () => {
    expect(keywordMatches('cat', { file: 'src/category.ts' })).toBe(false);
  });

  it('matches a multi-word keyword only as a contiguous run', () => {
    expect(keywordMatches('read only', { file: 'src/lessons/read-only-mode.ts' })).toBe(true);
    // "read" and "only" present but not adjacent -> no match.
    expect(keywordMatches('read only', { command: 'read the only docs' })).toBe(false);
  });

  it('does not fire when the keyword token is absent from file/command', () => {
    expect(keywordMatches('windows', { file: 'src/lessons/ranking.ts' })).toBe(false);
  });

  it('a degenerate (stopword/too-short) pattern never matches via the derived haystack', () => {
    expect(keywordMatches('a', { file: 'src/a.ts' })).toBe(false);
    expect(keywordMatches('the', { command: 'the test' })).toBe(false);
  });

  it('does not split joined identifiers — a multi-word pattern misses a camelCase/joined token', () => {
    // `readonly` is one token; "read only" (two tokens) is not a contiguous run in it.
    expect(keywordMatches('read only', { file: 'src/readonly.ts' })).toBe(false);
  });
});
