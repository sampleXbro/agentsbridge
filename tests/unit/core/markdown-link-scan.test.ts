import { describe, it, expect } from 'vitest';
import {
  applyRangeRewrites,
  getFencedCodeRanges,
  scanMarkdownLinks,
} from '../../../src/core/reference/markdown-link-scan.js';

describe('getFencedCodeRanges', () => {
  it('returns no ranges when no fences are present', () => {
    expect(getFencedCodeRanges('plain prose')).toEqual([]);
  });

  it('captures a backtick-fenced block including the closing fence', () => {
    const content = ['intro', '```ts', 'code()', '```', 'outro'].join('\n');
    const ranges = getFencedCodeRanges(content);
    expect(ranges).toHaveLength(1);
    const [start, end] = ranges[0]!;
    expect(content.slice(start, end)).toContain('```ts');
    expect(content.slice(start, end)).toContain('code()');
    expect(content.slice(start, end)).toContain('```');
  });

  it('also recognizes tilde-fenced blocks', () => {
    const content = ['~~~', 'x', '~~~'].join('\n');
    expect(getFencedCodeRanges(content)).toHaveLength(1);
  });
});

describe('scanMarkdownLinks', () => {
  it('finds inline links with destination offset and length', () => {
    const content = 'see [docs](docs/intro.md) please';
    const tokens = scanMarkdownLinks(content);
    expect(tokens).toHaveLength(1);
    const t = tokens[0]!;
    expect(t.kind).toBe('inline');
    expect(t.destination).toBe('docs/intro.md');
    expect(content.slice(t.destinationOffset, t.destinationOffset + t.destinationLength)).toBe(
      'docs/intro.md',
    );
  });

  it('tags image links as kind="image"', () => {
    const tokens = scanMarkdownLinks('![logo](assets/logo.png)');
    expect(tokens[0]!.kind).toBe('image');
  });

  it('parses reference definitions with label and destination offsets', () => {
    const content = 'see [ref][k]\n\n[k]: refs/topic.md\n';
    const tokens = scanMarkdownLinks(content);
    const ref = tokens.find((t) => t.kind === 'reference-def');
    expect(ref).toBeDefined();
    expect(ref!.label).toBe('k');
    expect(ref!.destination).toBe('refs/topic.md');
    expect(
      content.slice(ref!.destinationOffset, ref!.destinationOffset + ref!.destinationLength),
    ).toBe('refs/topic.md');
  });

  it('skips links inside fenced code blocks', () => {
    const content = ['```md', '[fake](should-not-match.md)', '```'].join('\n');
    expect(scanMarkdownLinks(content)).toEqual([]);
  });

  it('strips `<...>` and title suffix from inline destinations', () => {
    const content = '[t](<a/b.md> "Title")';
    const tokens = scanMarkdownLinks(content);
    expect(tokens[0]!.destination).toBe('a/b.md');
  });
});

describe('applyRangeRewrites', () => {
  it('returns the input unchanged when no rewrites are supplied', () => {
    expect(applyRangeRewrites('hello', [])).toBe('hello');
  });

  it('applies one in-range substitution', () => {
    const out = applyRangeRewrites('see [t](a.md) now', [
      { offset: 8, length: 4, replacement: 'b.md' },
    ]);
    expect(out).toBe('see [t](b.md) now');
  });

  it('applies multiple non-overlapping rewrites independent of input order', () => {
    const content = 'aaa BBB ccc DDD';
    const rewrites = [
      { offset: 4, length: 3, replacement: 'X' },
      { offset: 12, length: 3, replacement: 'Y' },
    ];
    expect(applyRangeRewrites(content, rewrites)).toBe('aaa X ccc Y');
    expect(applyRangeRewrites(content, [...rewrites].reverse())).toBe('aaa X ccc Y');
  });
});
