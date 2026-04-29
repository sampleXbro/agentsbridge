import { describe, expect, it } from 'vitest';
import { posix, win32 } from 'node:path';
import {
  WINDOWS_ABSOLUTE_PATH,
  isAbsoluteForProject,
  normalizeForProject,
  normalizeSeparators,
  pathApi,
  rootFallbackPath,
  stripTrailingPunctuation,
} from '../../../src/core/path-helpers.js';

describe('pathApi', () => {
  it('returns posix for POSIX project root', () => {
    expect(pathApi('/proj')).toBe(posix);
  });

  it('returns win32 for path containing backslash', () => {
    expect(pathApi('C:\\proj')).toBe(win32);
  });

  it('returns win32 for Windows-style absolute path', () => {
    expect(pathApi('C:/proj')).toBe(win32);
  });

  it('returns posix for relative POSIX path', () => {
    expect(pathApi('proj')).toBe(posix);
  });
});

describe('normalizeSeparators', () => {
  it('replaces backslashes with forward slashes', () => {
    expect(normalizeSeparators('a\\b\\c')).toBe('a/b/c');
  });

  it('passes POSIX paths through', () => {
    expect(normalizeSeparators('a/b/c')).toBe('a/b/c');
  });
});

describe('normalizeForProject', () => {
  it('strips trailing separator on POSIX', () => {
    expect(normalizeForProject('/proj', '/proj/foo/')).toBe('/proj/foo');
  });

  it('keeps single-character path', () => {
    expect(normalizeForProject('/proj', '/')).toBe('/');
  });

  it('normalizes win32 paths', () => {
    expect(normalizeForProject('C:\\proj', 'C:\\proj\\foo')).toBe('C:\\proj\\foo');
  });
});

describe('isAbsoluteForProject', () => {
  it('returns true for POSIX absolute path under POSIX root', () => {
    expect(isAbsoluteForProject('/proj', '/proj/foo')).toBe(true);
  });

  it('returns true for Windows absolute path even under POSIX root', () => {
    expect(isAbsoluteForProject('/proj', 'C:\\foo')).toBe(true);
  });

  it('returns false for relative path', () => {
    expect(isAbsoluteForProject('/proj', 'foo/bar')).toBe(false);
  });
});

describe('stripTrailingPunctuation', () => {
  it('peels punctuation in reverse order', () => {
    expect(stripTrailingPunctuation('foo.md.')).toEqual({ candidate: 'foo.md', suffix: '.' });
  });

  it('peels multiple trailing chars', () => {
    expect(stripTrailingPunctuation('foo.md!?')).toEqual({ candidate: 'foo.md', suffix: '!?' });
  });

  it('returns input unchanged when no trailing punct', () => {
    expect(stripTrailingPunctuation('foo.md')).toEqual({ candidate: 'foo.md', suffix: '' });
  });

  it('returns empty when token is all punctuation', () => {
    expect(stripTrailingPunctuation('!!!')).toEqual({ candidate: '', suffix: '!!!' });
  });
});

describe('rootFallbackPath', () => {
  it('returns root-joined path when token starts with ../', () => {
    expect(rootFallbackPath('../docs/x.md', '/proj')).toBe('/proj/docs/x.md');
  });

  it('returns root-joined path when token starts with ./', () => {
    expect(rootFallbackPath('./docs/x.md', '/proj')).toBe('/proj/docs/x.md');
  });

  it('returns null when token has no leading ../ or ./', () => {
    expect(rootFallbackPath('docs/x.md', '/proj')).toBeNull();
  });

  it('returns null when stripping leaves empty', () => {
    expect(rootFallbackPath('./', '/proj')).toBeNull();
  });

  it('strips multiple ../ prefixes', () => {
    expect(rootFallbackPath('../../docs/x.md', '/proj')).toBe('/proj/docs/x.md');
  });
});

describe('WINDOWS_ABSOLUTE_PATH constant', () => {
  it('matches uppercase drive letters', () => {
    expect(WINDOWS_ABSOLUTE_PATH.test('C:\\foo')).toBe(true);
    expect(WINDOWS_ABSOLUTE_PATH.test('Z:/bar')).toBe(true);
  });

  it('matches lowercase drive letters', () => {
    expect(WINDOWS_ABSOLUTE_PATH.test('c:\\foo')).toBe(true);
  });

  it('does not match POSIX paths', () => {
    expect(WINDOWS_ABSOLUTE_PATH.test('/usr/bin')).toBe(false);
  });
});
