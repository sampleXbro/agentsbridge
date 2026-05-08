import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
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

  // POSIX permission bits assertions only — NTFS does not carry rwx triplets,
  // so chmod() is largely a no-op on Windows and `mode & 0o777` returns 0o666
  // regardless of what writeFileAtomic requested.
  it.skipIf(process.platform === 'win32')(
    'writes shell scripts with executable mode 0o755 (H3)',
    async () => {
      const path = join(TEST_DIR, 'hook.sh');
      await writeFileAtomic(path, '#!/bin/sh\necho hi\n');
      const info = lstatSync(path);
      // Bottom 9 bits encode rwxrwxrwx; mask off file-type/setuid bits.
      expect((info.mode & 0o777).toString(8)).toBe('755');
    },
  );

  it.skipIf(process.platform === 'win32')(
    'does not mark non-script extensions as executable',
    async () => {
      const path = join(TEST_DIR, 'plain.md');
      await writeFileAtomic(path, '# hi\n');
      const info = lstatSync(path);
      // Should not have any execute bit set
      expect(info.mode & 0o111).toBe(0);
    },
  );

  it.skipIf(process.platform === 'win32')(
    'honors explicit mode option overriding extension inference',
    async () => {
      const path = join(TEST_DIR, 'forced.txt');
      await writeFileAtomic(path, 'x', { mode: 0o600 });
      const info = lstatSync(path);
      expect((info.mode & 0o777).toString(8)).toBe('600');
    },
  );

  it.skipIf(process.platform === 'win32')(
    'writes .bash and .zsh scripts as 0o755 too',
    async () => {
      const bashPath = join(TEST_DIR, 'a.bash');
      const zshPath = join(TEST_DIR, 'a.zsh');
      await writeFileAtomic(bashPath, '#!/bin/bash\n');
      await writeFileAtomic(zshPath, '#!/bin/zsh\n');
      expect((lstatSync(bashPath).mode & 0o777).toString(8)).toBe('755');
      expect((lstatSync(zshPath).mode & 0o777).toString(8)).toBe('755');
    },
  );

  it.skipIf(process.platform === 'win32')(
    'chmod after rename guarantees mode even when tmpfile pre-existed',
    async () => {
      const path = join(TEST_DIR, 'tmp-collision.sh');
      // Pre-create the tmp file with restrictive mode that wouldn't get the bit set
      // via writeFile()'s mode option (which only applies on initial create).
      writeFileSync(`${path}.tmp`, 'old', { mode: 0o600 });
      await writeFileAtomic(path, '#!/bin/sh\necho ok\n');
      expect((lstatSync(path).mode & 0o777).toString(8)).toBe('755');
    },
  );

  it('refuses to write when target path is an existing directory', async () => {
    const path = join(TEST_DIR, 'existing-dir');
    mkdirSync(path, { recursive: true });
    await expect(writeFileAtomic(path, 'x')).rejects.toThrow(/is a directory/);
  });

  it('cleans up .tmp sidecar if write fails', async () => {
    const dirAsFile = join(TEST_DIR, 'blocks-tmp');
    // Create a directory at the .tmp path so writeFile fails.
    mkdirSync(`${dirAsFile}.tmp`, { recursive: true });
    await expect(writeFileAtomic(dirAsFile, 'x')).rejects.toThrow(/Failed to write/);
    // The .tmp path still exists as the pre-created dir, but no orphaned file is left behind.
    // Also validate the happy path: no .tmp orphan after a successful write.
    const happy = join(TEST_DIR, 'happy.txt');
    await writeFileAtomic(happy, 'ok');
    expect(await exists(`${happy}.tmp`)).toBe(false);
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

  it('terminates on directory symlink back to an ancestor', async () => {
    const base = join(TEST_DIR, 'cycle-tree');
    mkdirSync(join(base, 'sub'), { recursive: true });
    writeFileSync(join(base, 'sub', 'leaf.txt'), 'x');
    symlinkSync(base, join(base, 'sub', 'back'), 'dir');
    const files = await readDirRecursive(base);
    expect(files.sort()).toEqual([join(base, 'sub', 'leaf.txt')].sort());
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
