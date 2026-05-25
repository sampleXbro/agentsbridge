/**
 * Branch coverage for src/install/links/scan-relative-links.ts:
 * - empty destination filter (line 36).
 * - anchor-only (#section) filter (line 37).
 * - absolute path filter (line 38).
 * - URL/scheme filter (line 39).
 * - {baseDir} expansion in stripPath.
 * - reference-def link with label.
 */

import { describe, it, expect } from 'vitest';
import { scanRelativeLinks } from '../../../../src/install/links/scan-relative-links.js';

describe('scanRelativeLinks — branch coverage', () => {
  it('skips empty destinations', () => {
    const links = scanRelativeLinks('[empty]()\n');
    expect(links).toEqual([]);
  });

  it('skips anchor-only destinations', () => {
    const links = scanRelativeLinks('[anchor](#section)');
    expect(links).toEqual([]);
  });

  it('skips absolute paths starting with /', () => {
    const links = scanRelativeLinks('[abs](/etc/passwd)');
    expect(links).toEqual([]);
  });

  it('skips URLs / scheme-prefixed destinations', () => {
    const links = scanRelativeLinks(
      '[link](https://example.com)\n[link](mailto:a@b.com)\n[link](tel:+123)',
    );
    expect(links).toEqual([]);
  });

  it('expands {baseDir}/X to X', () => {
    const links = scanRelativeLinks('[helper]({baseDir}/refs/notes.md)');
    expect(links).toHaveLength(1);
    expect(links[0]!.path).toBe('refs/notes.md');
  });

  it('expands bare {baseDir} to .', () => {
    const links = scanRelativeLinks('[here]({baseDir})');
    expect(links[0]!.path).toBe('.');
  });

  it('captures reference-def links with their label', () => {
    const links = scanRelativeLinks('Some text [ref][r]\n\n[r]: notes.md\n');
    const refDef = links.find((l) => l.kind === 'reference-def');
    expect(refDef).toBeDefined();
    expect(refDef!.label).toBe('r');
    expect(refDef!.path).toBe('notes.md');
  });

  it('captures image links as kind:image', () => {
    const links = scanRelativeLinks('![alt](assets/logo.png)');
    expect(links[0]!.kind).toBe('image');
    expect(links[0]!.path).toBe('assets/logo.png');
  });

  it('normalizes Windows backslash separators to forward slashes', () => {
    const links = scanRelativeLinks('[w](refs\\notes.md)');
    expect(links[0]!.path).toBe('refs/notes.md');
  });
});
