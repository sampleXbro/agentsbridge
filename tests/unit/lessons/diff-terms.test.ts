import { describe, expect, it } from 'vitest';
import { diffTerms } from '../../../src/lessons/diff-terms.js';

describe('diffTerms', () => {
  it('extracts tokens from an Edit new_string', () => {
    expect(diffTerms({ new_string: 'fix the redos vulnerability' }).split(' ')).toEqual([
      'fix',
      'redos',
      'vulnerability',
    ]);
  });

  it('extracts tokens from a Write content', () => {
    expect(diffTerms({ content: 'const secret = process.env.KEY' }).split(' ')).toContain('secret');
  });

  it('extracts tokens from MultiEdit edits[].new_string', () => {
    expect(
      diffTerms({ edits: [{ new_string: 'migration up' }, { new_string: 'rollback down' }] }).split(
        ' ',
      ),
    ).toEqual(['migration', 'up', 'rollback', 'down']);
  });

  it('is empty when there is no writable content (bash command, read, delete)', () => {
    expect(diffTerms({})).toBe('');
    expect(diffTerms({ new_string: '' })).toBe('');
    expect(diffTerms({ edits: 'not-an-array' })).toBe('');
    expect(diffTerms({ edits: [null, 42, 'str'] })).toBe('');
  });

  it('dedupes and preserves first-seen order', () => {
    expect(diffTerms({ content: 'foo foo bar foo bar baz' }).split(' ')).toEqual([
      'foo',
      'bar',
      'baz',
    ]);
  });

  it('drops stopwords and sub-2-char tokens via the shared tokenizer', () => {
    // 'a','to','be','or' are stopwords; 'x' is <2 chars — only 'migration' survives.
    expect(diffTerms({ content: 'a to be or x migration' }).split(' ')).toEqual(['migration']);
  });

  it('caps the token bag at 120 terms so a huge Write cannot flood recall', () => {
    const many = Array.from({ length: 300 }, (_, i) => `tok${i}`).join(' ');
    expect(diffTerms({ content: many }).split(' ').length).toBe(120);
  });
});
