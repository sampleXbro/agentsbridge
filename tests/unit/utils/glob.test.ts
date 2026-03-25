import { describe, it, expect } from 'vitest';
import { globMatch, globFilter } from '../../../src/utils/glob.js';

describe('globMatch', () => {
  // Basic wildcards
  it('* matches any single segment', () => {
    expect(globMatch('src/foo.ts', 'src/*.ts')).toBe(true);
    expect(globMatch('src/foo.js', 'src/*.ts')).toBe(false);
  });

  it('** matches zero or more segments', () => {
    expect(globMatch('src/a/b/c.ts', 'src/**/*.ts')).toBe(true);
    expect(globMatch('src/c.ts', 'src/**/*.ts')).toBe(true);
    expect(globMatch('other/c.ts', 'src/**/*.ts')).toBe(false);
  });

  it('? matches single character', () => {
    expect(globMatch('file1.ts', 'file?.ts')).toBe(true);
    expect(globMatch('file10.ts', 'file?.ts')).toBe(false);
  });

  // Braces
  it('{a,b} matches alternatives', () => {
    expect(globMatch('file.ts', '*.{ts,js}')).toBe(true);
    expect(globMatch('file.js', '*.{ts,js}')).toBe(true);
    expect(globMatch('file.py', '*.{ts,js}')).toBe(false);
  });

  // Edge cases
  it('exact match', () => {
    expect(globMatch('CLAUDE.md', 'CLAUDE.md')).toBe(true);
  });

  it('* alone matches everything in current level', () => {
    expect(globMatch('anything.txt', '*')).toBe(true);
    expect(globMatch('sub/file.txt', '*')).toBe(false);
  });

  it('** alone matches everything', () => {
    expect(globMatch('any/path/here.txt', '**')).toBe(true);
  });

  it('handles leading dot files', () => {
    expect(globMatch('.env', '.*')).toBe(true);
    expect(globMatch('.env', '*')).toBe(true);
  });

  it('lib/**/*.ts matches lib files but not src files', () => {
    expect(globFilter(['src/foo.ts'], 'lib/**/*.ts')).toEqual([]);
    expect(globFilter(['lib/bar.ts'], 'lib/**/*.ts')).toEqual(['lib/bar.ts']);
  });

  it('**/path matches path at any depth', () => {
    expect(globMatch('a/b/file.ts', '**/b/*.ts')).toBe(true);
    expect(globMatch('file.ts', '**/*.ts')).toBe(true);
  });

  it('escapes special regex chars', () => {
    expect(globMatch('file.js', 'file.js')).toBe(true);
    expect(globMatch('a+b', 'a+b')).toBe(true);
  });

  it('braces with empty inner returns pattern', () => {
    expect(globMatch('x', '{}')).toBe(false);
  });
});
