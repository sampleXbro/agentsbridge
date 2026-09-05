import { describe, expect, it } from 'vitest';
import { keywordMatches } from '../../../src/lessons/keyword-match.js';

describe('keywordMatches — explicit --keyword', () => {
  it('matches a whole token of the explicit keyword, case-insensitively', () => {
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

  it('does not split a LOWERCASE-joined identifier — "read only" misses "readonly"', () => {
    // `readonly` has no case/word boundary to split on, so it stays one token; only
    // camelCase / acronym boundaries are split (see the camelCase suite below).
    expect(keywordMatches('read only', { file: 'src/readonly.ts' })).toBe(false);
  });
});

describe('keywordMatches — camelCase / acronym reach (additive, backward compatible)', () => {
  it('a sub-word keyword reaches the camelCase identifier it is compressed inside', () => {
    expect(keywordMatches('guard', { file: 'src/lib/useLeaveGuard.ts' })).toBe(true);
    expect(keywordMatches('blocker', { file: 'src/lib/useBlocker.ts' })).toBe(true);
    expect(keywordMatches('selector', { file: 'src/ui/InvoiceCompanySelector.tsx' })).toBe(true);
  });

  it('a multi-word keyword matches contiguous camelCase sub-words', () => {
    expect(keywordMatches('company selector', { file: 'src/ui/InvoiceCompanySelector.tsx' })).toBe(
      true,
    );
    expect(keywordMatches('number input', { file: 'src/components/MaskedNumberInput.tsx' })).toBe(
      true,
    );
  });

  it('splits an ACRONYM→Word boundary (HTMLParser → html, parser)', () => {
    expect(keywordMatches('parser', { file: 'src/HTMLParser.ts' })).toBe(true);
  });

  it('BACKWARD COMPATIBLE — the whole compressed identifier still matches', () => {
    // A trigger authored as the full identifier keeps firing: the whole token is retained.
    expect(keywordMatches('useblocker', { file: 'src/lib/useBlocker.ts' })).toBe(true);
  });

  it('stays token-exact, NOT substring — an infix that is not a boundary does not match', () => {
    // 'ompan' sits inside 'Company' but is not a boundary token → no match (precision kept).
    expect(keywordMatches('ompan', { file: 'src/ui/InvoiceCompanySelector.tsx' })).toBe(false);
    // 'category' has no boundary, so 'cat' still does not fire (unchanged).
    expect(keywordMatches('cat', { file: 'src/category.ts' })).toBe(false);
  });
});

describe('keywordMatches — explicit --keyword on token boundaries (not substring)', () => {
  it('does not fire on a mid-word fragment — "art" must not match "start"', () => {
    expect(keywordMatches('art', { keyword: 'please start the server' })).toBe(false);
  });

  it('fires on a whole token of the prompt', () => {
    expect(keywordMatches('art', { keyword: 'the art of x' })).toBe(true);
  });

  it('a multi-word pattern must appear as a contiguous run in the prompt', () => {
    expect(keywordMatches('read only', { keyword: 'open in read-only mode' })).toBe(true);
    expect(keywordMatches('read only', { keyword: 'read the only file' })).toBe(false);
  });
});
