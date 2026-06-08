import { describe, expect, it } from 'vitest';
import { normalizeRecallFile } from '../../../src/lessons/normalize-query-file.js';

const ROOT = '/home/user/proj';

describe('normalizeRecallFile', () => {
  it('leaves an already project-relative forward-slash path unchanged', () => {
    expect(normalizeRecallFile('src/lessons/query.ts', ROOT)).toBe('src/lessons/query.ts');
  });

  it('strips a leading ./ so it matches a project-relative glob', () => {
    expect(normalizeRecallFile('./src/lessons/query.ts', ROOT)).toBe('src/lessons/query.ts');
  });

  it('relativizes an absolute path inside the project root', () => {
    expect(normalizeRecallFile('/home/user/proj/src/lessons/query.ts', ROOT)).toBe(
      'src/lessons/query.ts',
    );
  });

  it('converts Windows backslashes to forward slashes', () => {
    expect(normalizeRecallFile('src\\lessons\\query.ts', ROOT)).toBe('src/lessons/query.ts');
  });

  it('relativizes an absolute backslash path inside the root', () => {
    expect(normalizeRecallFile('/home/user/proj/src\\lessons\\query.ts', ROOT)).toBe(
      'src/lessons/query.ts',
    );
  });

  it('keeps a path outside the project root as a ../ relative path (project globs will not match it)', () => {
    expect(normalizeRecallFile('/home/other/file.ts', ROOT)).toBe('../../other/file.ts');
  });

  it('collapses redundant segments', () => {
    expect(normalizeRecallFile('src/./lessons/../lessons/query.ts', ROOT)).toBe(
      'src/lessons/query.ts',
    );
  });
});
