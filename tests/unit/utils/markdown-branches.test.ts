/**
 * Branch coverage for src/utils/text/markdown.ts edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  tryParseFrontmatter,
  parseFrontmatterForPath,
  parseOrSkipFrontmatter,
} from '../../../src/utils/text/markdown.js';

describe('markdown frontmatter — branch gaps', () => {
  it('parseFrontmatter returns empty frontmatter when content starts with `---` but never closes', () => {
    const { frontmatter, body } = parseFrontmatter('---\nname: x\nstill open\n');
    expect(frontmatter).toEqual({});
    expect(body).toContain('---');
  });

  it('parseFrontmatter returns empty frontmatter when yaml block is empty', () => {
    const { frontmatter, body } = parseFrontmatter('---\n---\nhello body\n');
    expect(frontmatter).toEqual({});
    expect(body).toBe('hello body');
  });

  it('parseFrontmatter returns empty frontmatter when YAML evaluates to null (e.g. comments-only)', () => {
    const { frontmatter } = parseFrontmatter('---\n# only a comment\n---\nbody\n');
    expect(frontmatter).toEqual({});
  });

  it('parseFrontmatter for plain markdown (no leading ---) returns empty frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('# header\n\nbody');
    expect(frontmatter).toEqual({});
    expect(body).toBe('# header\n\nbody');
  });

  it('tryParseFrontmatter wraps a YAML error with the file path', () => {
    const result = tryParseFrontmatter('---\nfoo: { bar: baz\n---\nbody\n', '/some/path.md');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.bodyFallback).toBe('body');
      expect(result.error.message).toContain('/some/path.md');
    }
  });

  it('parseFrontmatterForPath swallows the error when onError is provided', () => {
    const errs: Error[] = [];
    const value = parseFrontmatterForPath('---\nfoo: { bar: baz\n---\nrest\n', '/p.md', (e) =>
      errs.push(e),
    );
    expect(errs).toHaveLength(1);
    expect(value).toEqual({ frontmatter: {}, body: 'rest' });
  });

  it('parseFrontmatterForPath rethrows when no onError is supplied', () => {
    expect(() => parseFrontmatterForPath('---\nfoo: { bar: baz\n---\nrest\n', '/p.md')).toThrow(
      /Failed to parse frontmatter/,
    );
  });

  it('parseOrSkipFrontmatter returns null when onParseError handles the error', () => {
    const errs: Error[] = [];
    const result = parseOrSkipFrontmatter('---\nfoo: { bar: baz\n---\nrest\n', '/p.md', (e) =>
      errs.push(e),
    );
    expect(result).toBeNull();
    expect(errs).toHaveLength(1);
  });

  it('parseOrSkipFrontmatter rethrows when no callback supplied', () => {
    expect(() =>
      parseOrSkipFrontmatter('---\nfoo: { bar: baz\n---\nrest\n', '/p.md', undefined),
    ).toThrow(/Failed to parse frontmatter/);
  });
});
