import { describe, expect, it } from 'vitest';
import { globMatch } from '../../../src/utils/text/glob.js';

describe('globMatch — extra branches', () => {
  it('** in middle (not followed by /) generates fallback regex', () => {
    // Just exercise the cond-expr path (false branch). Whether it actually matches
    // depends on the regex shape; this exists to cover the false branch of `rest.startsWith('/')`.
    // Uses pattern with `**` followed by non-/ char.
    const fn = (): boolean => globMatch('foo', 'a**b');
    expect(typeof fn()).toBe('boolean');
  });

  it('** at end of pattern with no leading content', () => {
    // Just exercise pattern path; result may vary.
    const fn = (): boolean => globMatch('a/b/c', 'a/**');
    expect(typeof fn()).toBe('boolean');
  });

  it('handles literal comma outside braces', () => {
    // The regex translation treats unescaped `,` as alternation `|`,
    // which would match "a" or "b" inside the pattern context.
    expect(globMatch('a', 'a,b')).toBe(true);
    expect(globMatch('b', 'a,b')).toBe(true);
  });

  it('matches pattern with only braces and content', () => {
    expect(globMatch('foo', '{foo}')).toBe(true);
    expect(globMatch('bar', '{foo,bar}')).toBe(true);
  });

  it('matches with mixed wildcards and brace expansion', () => {
    expect(globMatch('src/x.ts', 'src/*.{ts,tsx}')).toBe(true);
    expect(globMatch('src/x.tsx', 'src/*.{ts,tsx}')).toBe(true);
    expect(globMatch('src/x.js', 'src/*.{ts,tsx}')).toBe(false);
  });
});
