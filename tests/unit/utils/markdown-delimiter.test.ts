/** The closing `---` must be a line of its own; a `---` inside a value is content. */
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, tryParseFrontmatter } from '../../../src/utils/text/markdown.js';
import { insertAtBodyTop } from '../../../src/targets/projection/managed-blocks.js';

describe('parseFrontmatter: line-anchored closing delimiter', () => {
  it('keeps a --- inside a plain scalar value', () => {
    const parsed = parseFrontmatter(
      '---\ndescription: Use --- to separate sections\n---\n\n# Body\n',
    );
    expect(parsed).toEqual({
      frontmatter: { description: 'Use --- to separate sections' },
      body: '# Body',
    });
  });

  it('keeps a --- inside a quoted scalar value', () => {
    const parsed = parseFrontmatter('---\ndescription: "a --- b"\n---\nbody\n');
    expect(parsed.frontmatter).toEqual({ description: 'a --- b' });
    expect(parsed.body).toBe('body');
  });

  it('leaves horizontal rules in the body alone', () => {
    const parsed = parseFrontmatter('---\nkey: v\n---\n\nabove\n\n---\n\nbelow\n');
    expect(parsed.frontmatter).toEqual({ key: 'v' });
    expect(parsed.body).toBe('above\n\n---\n\nbelow');
  });

  it('accepts CRLF line endings and trailing spaces on the delimiter', () => {
    const parsed = parseFrontmatter('---  \r\nkey: v\r\n--- \r\n\r\nbody\r\n');
    expect(parsed.frontmatter).toEqual({ key: 'v' });
    expect(parsed.body).toBe('body');
  });

  it('accepts a closing delimiter at end of input without a newline', () => {
    expect(parseFrontmatter('---\nkey: v\n---')).toEqual({ frontmatter: { key: 'v' }, body: '' });
  });

  it('treats an unclosed block as body-only', () => {
    expect(parseFrontmatter('---\nkey: v\nno close')).toEqual({
      frontmatter: {},
      body: '---\nkey: v\nno close',
    });
  });

  it('does not treat a longer dash rule at the top as an opener', () => {
    expect(parseFrontmatter('----\nkey: v\n---\nbody')).toEqual({
      frontmatter: {},
      body: '----\nkey: v\n---\nbody',
    });
  });

  it('lenient fallback body uses the same anchored close', () => {
    const result = tryParseFrontmatter(
      '---\ndescription: [unclosed\nx: --- y\n---\n\nbody\n',
      'f.md',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.bodyFallback).toBe('body');
  });
});

describe('insertAtBodyTop: frontmatter prefix survives a --- inside a value', () => {
  it('injects after the whole frontmatter block', () => {
    const out = insertAtBodyTop(
      '---\ndescription: Use --- here\n---\n\n# Body\n',
      '<!-- block -->',
    );
    expect(out).toBe('---\ndescription: Use --- here\n---\n\n<!-- block -->\n\n# Body');
  });
});
