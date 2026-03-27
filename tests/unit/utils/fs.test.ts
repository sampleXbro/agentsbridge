import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readFileSafe,
  writeFileAtomic,
  exists,
  mkdirp,
  readDirRecursive,
  copyDir,
  ensureCacheSymlink,
} from '../../../src/utils/filesystem/fs.js';
import { readlinkSync, lstatSync } from 'node:fs';

const TEST_DIR = join(tmpdir(), 'agentsmesh-test-fs');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('readFileSafe', () => {
  it('reads existing file as utf-8 string', async () => {
    writeFileSync(join(TEST_DIR, 'test.txt'), 'hello');
    expect(await readFileSafe(join(TEST_DIR, 'test.txt'))).toBe('hello');
  });

  it('returns null for non-existent file', async () => {
    expect(await readFileSafe(join(TEST_DIR, 'nope.txt'))).toBeNull();
  });

  it('handles UTF-8 BOM', async () => {
    writeFileSync(join(TEST_DIR, 'bom.txt'), '\uFEFFhello');
    expect(await readFileSafe(join(TEST_DIR, 'bom.txt'))).toBe('hello');
  });
});

describe('writeFileAtomic', () => {
  it('writes content to file', async () => {
    const path = join(TEST_DIR, 'out.txt');
    await writeFileAtomic(path, 'content');
    expect(await readFileSafe(path)).toBe('content');
  });

  it('creates parent directories', async () => {
    const path = join(TEST_DIR, 'deep', 'nested', 'file.txt');
    await writeFileAtomic(path, 'deep');
    expect(await readFileSafe(path)).toBe('deep');
  });

  it('overwrites existing file', async () => {
    const path = join(TEST_DIR, 'overwrite.txt');
    await writeFileAtomic(path, 'first');
    await writeFileAtomic(path, 'second');
    expect(await readFileSafe(path)).toBe('second');
  });
});

describe('exists', () => {
  it('returns true for existing file', async () => {
    writeFileSync(join(TEST_DIR, 'exists.txt'), '');
    expect(await exists(join(TEST_DIR, 'exists.txt'))).toBe(true);
  });

  it('returns false for non-existent', async () => {
    expect(await exists(join(TEST_DIR, 'nope.txt'))).toBe(false);
  });
});

describe('mkdirp', () => {
  it('creates nested directories', async () => {
    await mkdirp(join(TEST_DIR, 'a', 'b', 'c'));
    expect(await exists(join(TEST_DIR, 'a', 'b', 'c'))).toBe(true);
  });

  it('does not throw if directory exists', async () => {
    await mkdirp(TEST_DIR);
    // Should not throw
  });
});

describe('readDirRecursive', () => {
  it('lists all files recursively', async () => {
    mkdirSync(join(TEST_DIR, 'sub'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'a.txt'), '');
    writeFileSync(join(TEST_DIR, 'sub', 'b.txt'), '');
    const files = await readDirRecursive(TEST_DIR);
    expect(files.sort()).toEqual([join(TEST_DIR, 'a.txt'), join(TEST_DIR, 'sub', 'b.txt')].sort());
  });

  it('returns empty array for empty directory', async () => {
    expect(await readDirRecursive(TEST_DIR)).toEqual([]);
  });

  it('returns empty array for non-existent directory', async () => {
    expect(await readDirRecursive(join(TEST_DIR, 'nope'))).toEqual([]);
  });
});

describe('ensureCacheSymlink', () => {
  it('creates symlink when link does not exist', async () => {
    const cacheDir = join(TEST_DIR, 'cache');
    const linkPath = join(TEST_DIR, '.agentsmeshcache');
    mkdirSync(cacheDir, { recursive: true });
    await ensureCacheSymlink(cacheDir, linkPath);
    expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(readlinkSync(linkPath)).toBe(cacheDir);
  });

  it('updates symlink when it points to wrong target', async () => {
    const cacheDir = join(TEST_DIR, 'cache');
    const wrongDir = join(TEST_DIR, 'wrong');
    const linkPath = join(TEST_DIR, '.agentsmeshcache');
    mkdirSync(cacheDir, { recursive: true });
    mkdirSync(wrongDir, { recursive: true });
    await ensureCacheSymlink(wrongDir, linkPath);
    await ensureCacheSymlink(cacheDir, linkPath);
    expect(readlinkSync(linkPath)).toBe(cacheDir);
  });

  it('leaves existing non-symlink alone', async () => {
    const cacheDir = join(TEST_DIR, 'cache');
    const linkPath = join(TEST_DIR, '.agentsmeshcache');
    mkdirSync(cacheDir, { recursive: true });
    mkdirSync(linkPath, { recursive: true }); // real dir
    await ensureCacheSymlink(cacheDir, linkPath);
    expect(lstatSync(linkPath).isDirectory()).toBe(true);
    expect(lstatSync(linkPath).isSymbolicLink()).toBe(false);
  });
});

describe('copyDir', () => {
  it('copies directory recursively', async () => {
    const src = join(TEST_DIR, 'src-dir');
    const dest = join(TEST_DIR, 'dest-dir');
    mkdirSync(join(src, 'sub'), { recursive: true });
    writeFileSync(join(src, 'a.txt'), 'aa');
    writeFileSync(join(src, 'sub', 'b.txt'), 'bb');
    await copyDir(src, dest);
    expect(await readFileSafe(join(dest, 'a.txt'))).toBe('aa');
    expect(await readFileSafe(join(dest, 'sub', 'b.txt'))).toBe('bb');
  });
});
