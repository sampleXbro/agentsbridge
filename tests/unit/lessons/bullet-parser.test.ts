import { describe, it, expect } from 'vitest';
import { parseBullets } from '../../../src/lessons/bullet-parser.js';

describe('parseBullets', () => {
  it('skips the H1 title and parses top-level bullets', () => {
    const md = ['# Lessons Learned', '', '- **A**: rule A', '- **B**: rule B'].join('\n');
    expect(parseBullets(md)).toEqual([
      { text: '- **A**: rule A', lineNumber: 3 },
      { text: '- **B**: rule B', lineNumber: 4 },
    ]);
  });

  it('captures multi-line bullets (continuation indented)', () => {
    const md = ['- **A**: starts', '  continues here', '- **B**: next'].join('\n');
    const result = parseBullets(md);
    expect(result).toHaveLength(2);
    expect(result[0]?.text).toBe('- **A**: starts\n  continues here');
  });

  it('ignores empty lines between bullets', () => {
    const md = ['- **A**', '', '- **B**'].join('\n');
    expect(parseBullets(md)).toHaveLength(2);
  });

  it('closes an open bullet when a non-indented non-bullet line follows', () => {
    const md = ['- **A**: starts', '## Some heading', '- **B**: next'].join('\n');
    const result = parseBullets(md);
    expect(result).toHaveLength(2);
    expect(result[0]?.text).toBe('- **A**: starts');
    expect(result[1]?.text).toBe('- **B**: next');
  });

  it('accepts asterisk-marker bullets', () => {
    const md = ['* **A**: rule', '* **B**: rule'].join('\n');
    expect(parseBullets(md)).toHaveLength(2);
  });

  it('emits a trailing bullet when EOF arrives mid-bullet', () => {
    const md = ['- **A**: open', '  continued line'].join('\n');
    const result = parseBullets(md);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('- **A**: open\n  continued line');
  });

  it('handles EOF when no bullet is currently open (trailing empty lines)', () => {
    const md = ['- **A**: closed', '', ''].join('\n');
    const result = parseBullets(md);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('- **A**: closed');
  });

  it('returns [] for empty input', () => {
    expect(parseBullets('')).toEqual([]);
  });
});
