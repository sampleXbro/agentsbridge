import { describe, it, expect } from 'vitest';
import { isExcludedProjectPath } from '../../../../src/core/lint/linter.js';

describe('isExcludedProjectPath', () => {
  it.each([
    'node_modules/x/y.ts',
    'src/node_modules/y.ts',
    'dist/a.js',
    '.git/HEAD',
    'coverage/lcov.info',
  ])('excludes %s', (rel) => expect(isExcludedProjectPath(rel)).toBe(true));

  it('excludes the same paths with Windows separators', () => {
    expect(isExcludedProjectPath('node_modules\\x\\y.ts')).toBe(true);
    expect(isExcludedProjectPath('src\\node_modules\\y.ts')).toBe(true);
    expect(isExcludedProjectPath('dist\\a.js')).toBe(true);
  });

  it('keeps look-alike names', () => {
    expect(isExcludedProjectPath('src/a.ts')).toBe(false);
    expect(isExcludedProjectPath('srcdist/a.ts')).toBe(false);
    expect(isExcludedProjectPath('my-node_modules-notes.md')).toBe(false);
  });
});
