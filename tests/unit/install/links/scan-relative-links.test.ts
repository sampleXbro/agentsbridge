import { describe, it, expect } from 'vitest';
import { scanRelativeLinks } from '../../../../src/install/links/scan-relative-links.js';

describe('scanRelativeLinks - inline links', () => {
  it('extracts a single inline relative link', () => {
    const links = scanRelativeLinks('See [docs](docs/intro.md) for details.');
    expect(links).toHaveLength(1);
    expect(links[0]!.kind).toBe('inline');
    expect(links[0]!.path).toBe('docs/intro.md');
  });

  it('extracts image links and tags them as kind="image"', () => {
    const links = scanRelativeLinks('![logo](assets/logo.png)');
    expect(links).toHaveLength(1);
    expect(links[0]!.kind).toBe('image');
    expect(links[0]!.path).toBe('assets/logo.png');
  });

  it('extracts multiple inline links in one body', () => {
    const md = '[a](a.md) and [b](b.md) plus [c](c.md).';
    const links = scanRelativeLinks(md);
    expect(links.map((l) => l.path)).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('preserves a #anchor suffix in the path', () => {
    const links = scanRelativeLinks('See [section](refs/topic.md#intro).');
    expect(links).toHaveLength(1);
    expect(links[0]!.path).toBe('refs/topic.md#intro');
  });

  it('extracts ../ links (resolve-link is responsible for rejecting escapes)', () => {
    const links = scanRelativeLinks('Up: [out](../../outside.md).');
    expect(links).toHaveLength(1);
    expect(links[0]!.path).toBe('../../outside.md');
  });

  it('handles links with titles by extracting the bare destination', () => {
    const links = scanRelativeLinks('[link](path/to/x.md "Title")');
    expect(links).toHaveLength(1);
    expect(links[0]!.path).toBe('path/to/x.md');
  });

  it('handles angle-bracketed destinations', () => {
    const links = scanRelativeLinks('[link](<path/with spaces.md>)');
    expect(links).toHaveLength(1);
    expect(links[0]!.path).toBe('path/with spaces.md');
  });
});

describe('scanRelativeLinks - non-relative destinations are skipped', () => {
  it('skips https:// links', () => {
    expect(scanRelativeLinks('[ext](https://example.com/x)')).toEqual([]);
  });

  it('skips http:// links', () => {
    expect(scanRelativeLinks('[ext](http://example.com/x)')).toEqual([]);
  });

  it('skips mailto: links', () => {
    expect(scanRelativeLinks('[mail](mailto:a@example.com)')).toEqual([]);
  });

  it('skips tel: / javascript: / data: / ftp: links', () => {
    expect(scanRelativeLinks('[t](tel:+1)')).toEqual([]);
    expect(scanRelativeLinks('[j](javascript:alert(1))')).toEqual([]);
    expect(scanRelativeLinks('[d](data:text/plain,abc)')).toEqual([]);
    expect(scanRelativeLinks('[f](ftp://example.com/x)')).toEqual([]);
  });

  it('skips bare anchors (no path before the #)', () => {
    expect(scanRelativeLinks('[here](#section)')).toEqual([]);
  });

  it('skips absolute / paths', () => {
    expect(scanRelativeLinks('[abs](/etc/passwd)')).toEqual([]);
  });
});

describe('scanRelativeLinks - reference-style links', () => {
  it('extracts a reference-link definition as kind="reference-def"', () => {
    const md = 'See [docs][id].\n\n[id]: refs/x.md\n';
    const links = scanRelativeLinks(md);
    expect(links).toHaveLength(1);
    expect(links[0]!.kind).toBe('reference-def');
    expect(links[0]!.path).toBe('refs/x.md');
    expect(links[0]!.label).toBe('id');
  });

  it('extracts reference-def with angle-bracketed destination', () => {
    const md = 'See [d][id].\n\n[id]: <refs/with spaces.md>\n';
    const links = scanRelativeLinks(md);
    expect(links).toHaveLength(1);
    expect(links[0]!.path).toBe('refs/with spaces.md');
  });

  it('does not also emit an "inline" link for the [text][id] usage site', () => {
    const md = 'See [docs][id].\n\n[id]: refs/x.md\n';
    const links = scanRelativeLinks(md);
    expect(links.map((l) => l.kind)).toEqual(['reference-def']);
  });

  it('skips reference defs whose destination is non-relative', () => {
    const md = '[d][id]\n\n[id]: https://example.com/x\n';
    expect(scanRelativeLinks(md)).toEqual([]);
  });
});

describe('scanRelativeLinks - fenced code blocks', () => {
  it('skips inline links inside ``` fences', () => {
    const md = ['Example:', '```md', '[x](nope.md)', '```', 'But [real](real.md) counts.'].join(
      '\n',
    );
    const links = scanRelativeLinks(md);
    expect(links.map((l) => l.path)).toEqual(['real.md']);
  });

  it('skips inline links inside ~~~ fences', () => {
    const md = ['~~~', '[hidden](skip.md)', '~~~', '[seen](seen.md)'].join('\n');
    const links = scanRelativeLinks(md);
    expect(links.map((l) => l.path)).toEqual(['seen.md']);
  });

  it('skips reference defs inside fenced blocks', () => {
    const md = [
      'Use [d][id].',
      '```',
      '[fake]: nope.md',
      '```',
      '',
      '[id]: real-def.md',
    ].join('\n');
    const links = scanRelativeLinks(md);
    expect(links.map((l) => l.path)).toEqual(['real-def.md']);
  });
});

describe('scanRelativeLinks - degenerate inputs', () => {
  it('returns [] for an empty body', () => {
    expect(scanRelativeLinks('')).toEqual([]);
  });

  it('returns [] for prose without any markdown links', () => {
    expect(scanRelativeLinks('# Heading\n\nJust some prose.\n')).toEqual([]);
  });
});
