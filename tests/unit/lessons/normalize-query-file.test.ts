import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
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

describe('normalizeRecallFile — boundary', () => {
  it('falls back to the forward-slashed input when the path IS the project root', () => {
    // relative(root, root) === '' — must not emit an empty path.
    expect(normalizeRecallFile('/proj', '/proj')).toBe('/proj');
  });
});

describe('normalizeRecallFile — symlinked project root', () => {
  // The CLI derives projectRoot from process.cwd() (the PHYSICAL path), while a
  // harness passes a LOGICAL absolute --file/file_path that traverses a symlink
  // (macOS /tmp -> /private/tmp). Without realpath both sides, relative() yields
  // a ../-escaping path and recall (incl. the PostToolUse hook) silently matches
  // zero lessons. Symlink creation is unreliable on Windows runners.
  const dirs: string[] = [];
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it.skipIf(process.platform === 'win32')(
    'relativizes a logical (symlinked) absolute path against the physical root',
    () => {
      const base = mkdtempSync(join(realpathSync(tmpdir()), 'amesh-symlink-'));
      dirs.push(base);
      const physicalRoot = join(base, 'physical');
      mkdirSync(join(physicalRoot, 'src'), { recursive: true });
      writeFileSync(join(physicalRoot, 'src', 'a.ts'), '');
      const logicalRoot = join(base, 'logical');
      symlinkSync(physicalRoot, logicalRoot);

      // projectRoot = physical, --file = logical (through the symlink).
      const logicalFile = join(logicalRoot, 'src', 'a.ts');
      expect(normalizeRecallFile(logicalFile, physicalRoot)).toBe('src/a.ts');
    },
  );

  it.skipIf(process.platform === 'win32')(
    'relativizes a physical absolute path against a logical (symlinked) root',
    () => {
      const base = mkdtempSync(join(realpathSync(tmpdir()), 'amesh-symlink-'));
      dirs.push(base);
      const physicalRoot = join(base, 'physical');
      mkdirSync(join(physicalRoot, 'src'), { recursive: true });
      writeFileSync(join(physicalRoot, 'src', 'a.ts'), '');
      const logicalRoot = join(base, 'logical');
      symlinkSync(physicalRoot, logicalRoot);

      // projectRoot = logical, --file = physical (the inverse mismatch).
      const physicalFile = join(physicalRoot, 'src', 'a.ts');
      expect(normalizeRecallFile(physicalFile, logicalRoot)).toBe('src/a.ts');
    },
  );

  it.skipIf(process.platform === 'win32')(
    'relativizes a not-yet-existing file under a symlinked root (capture target path)',
    () => {
      const base = mkdtempSync(join(realpathSync(tmpdir()), 'amesh-symlink-'));
      dirs.push(base);
      const physicalRoot = join(base, 'physical');
      mkdirSync(physicalRoot, { recursive: true });
      const logicalRoot = join(base, 'logical');
      symlinkSync(physicalRoot, logicalRoot);

      // File does not exist yet — realpath of the full path would throw.
      const logicalFile = join(logicalRoot, 'src', 'new', 'b.ts');
      expect(normalizeRecallFile(logicalFile, physicalRoot)).toBe('src/new/b.ts');
    },
  );
});
