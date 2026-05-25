/**
 * Branch coverage for fs-traverse error paths that surface unknown errno
 * codes from `realpath`/`readdir`. The "early-return on ENOENT/ENOTDIR/..."
 * branches are exercised by the main fs.test.ts suite — these tests pin the
 * "rethrow as FileSystemError" branches so a regression that silently
 * swallows a real I/O error is caught.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fsPromises from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  readDirRecursive,
  readDirRecursiveNoSymlinks,
  ensureCacheSymlink,
} from '../../../src/utils/filesystem/fs.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  return {
    ...actual,
  };
});

beforeEach(() => {
  vi.restoreAllMocks();
});

function errnoErr(code: string): NodeJS.ErrnoException {
  const e = new Error(`fake ${code}`) as NodeJS.ErrnoException;
  e.code = code;
  return e;
}

describe('readDirRecursive — error rethrow', () => {
  it('rethrows realpath errors that are not ENOENT/ENOTDIR/ELOOP as FileSystemError', async () => {
    const spy = vi.spyOn(fsPromises, 'realpath').mockRejectedValueOnce(errnoErr('EACCES'));
    await expect(readDirRecursive('/no-matter')).rejects.toThrow(/Failed to read directory/);
    spy.mockRestore();
  });

  it('rethrows readdir errors that are not ENOENT/ENOTDIR/EACCES as FileSystemError', async () => {
    // realpath has to succeed first so we reach the readdir try/catch.
    const realpathSpy = vi.spyOn(fsPromises, 'realpath').mockResolvedValueOnce('/fake');
    const readdirSpy = vi.spyOn(fsPromises, 'readdir').mockRejectedValueOnce(errnoErr('EIO'));
    await expect(readDirRecursive('/no-matter')).rejects.toThrow(/Failed to read directory/);
    realpathSpy.mockRestore();
    readdirSpy.mockRestore();
  });
});

describe('readDirRecursiveNoSymlinks — error rethrow', () => {
  it('rethrows readdir errors that are not ENOENT/ENOTDIR/EACCES as FileSystemError', async () => {
    const spy = vi.spyOn(fsPromises, 'readdir').mockRejectedValueOnce(errnoErr('EIO'));
    await expect(readDirRecursiveNoSymlinks('/no-matter')).rejects.toThrow(
      /Failed to read directory/,
    );
    spy.mockRestore();
  });
});

describe('readDirRecursive — MAX_RECURSIVE_DEPTH guard', () => {
  it('skips branches deeper than the depth limit (uniquely-named segments)', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'am-deep-dir-'));
    try {
      const { mkdirSync, writeFileSync } = await import('node:fs');
      // Build a uniquely-named 34-segment chain so the depth limit fires
      // BEFORE the segment-repetition guard (each name is unique).
      let cur = workDir;
      const TOTAL_DEPTH = 34;
      for (let i = 0; i < TOTAL_DEPTH; i++) {
        cur = join(cur, `seg-${i}`);
        mkdirSync(cur);
      }
      writeFileSync(join(cur, 'leaf.txt'), 'leaf');

      // The depth guard skips the deepest branches → the leaf is not returned.
      const files = await readDirRecursive(workDir);
      expect(files).toEqual([]);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});

describe('copyDir — lstat-says-symlink race guard', () => {
  it('skips an entry that readdir reported as non-symlink but lstat resolves to a symlink', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'am-copydir-race-'));
    const src = join(workDir, 'src');
    const dest = join(workDir, 'dest');
    try {
      // Real on-disk file under src so readdir returns it as a regular entry.
      const { mkdirSync, writeFileSync } = await import('node:fs');
      mkdirSync(src);
      writeFileSync(join(src, 'real.txt'), 'real');

      const { copyDir } = await import('../../../src/utils/filesystem/fs.js');
      // Force lstat to claim the entry is a symlink, exercising the
      // post-readdir defensive symlink check (line 161).
      const lstatSpy = vi.spyOn(fsPromises, 'lstat').mockImplementationOnce(
        async () =>
          ({
            isSymbolicLink: () => true,
            isDirectory: () => false,
            isFile: () => false,
          }) as unknown as Awaited<ReturnType<typeof fsPromises.lstat>>,
      );

      await copyDir(src, dest);
      // The file is skipped because lstat reported a symlink.
      const { existsSync } = await import('node:fs');
      expect(existsSync(join(dest, 'real.txt'))).toBe(false);

      lstatSpy.mockRestore();
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});

describe('ensureCacheSymlink — error rethrow', () => {
  it('rethrows lstat errors that are not ENOENT', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'am-cache-symlink-err-'));
    try {
      const spy = vi.spyOn(fsPromises, 'lstat').mockRejectedValueOnce(errnoErr('EACCES'));
      await expect(
        ensureCacheSymlink(join(workDir, 'cache'), join(workDir, 'link')),
      ).rejects.toThrow(/fake EACCES/);
      spy.mockRestore();
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
