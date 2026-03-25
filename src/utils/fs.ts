/**
 * File system helpers for agentsbridge.
 */

import {
  readFile,
  writeFile,
  access,
  mkdir,
  rename,
  readdir,
  copyFile,
  stat,
  symlink,
  unlink,
  lstat,
  readlink,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { constants } from 'node:fs';

const UTF8_BOM = '\uFEFF';

interface ErrnoLike {
  code?: string;
  message: string;
}

/**
 * Read file as utf-8 string. Strips BOM. Returns null on ENOENT.
 * @param path - Absolute or relative file path
 * @returns File content or null if not found
 */
export async function readFileSafe(path: string): Promise<string | null> {
  try {
    const data = await readFile(path, 'utf-8');
    return data.startsWith(UTF8_BOM) ? data.slice(UTF8_BOM.length) : data;
  } catch (err) {
    const e = err as ErrnoLike;
    if (e.code === 'ENOENT') return null;
    throw new Error(
      `Failed to read ${path}: ${e.message}. Ensure the file exists and is readable.`,
      { cause: err },
    );
  }
}

/**
 * Write content atomically (write to .tmp, then rename).
 * Creates parent directories.
 * @param path - Target file path
 * @param content - Content to write
 */
export async function writeFileAtomic(path: string, content: string): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tmpPath = `${path}.tmp`;
  try {
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, path);
  } catch (err) {
    const e = err as ErrnoLike;
    throw new Error(`Failed to write ${path}: ${e.message}. Check permissions and disk space.`, {
      cause: err,
    });
  }
}

/**
 * Check if path exists.
 * @param path - File or directory path
 * @returns true if exists, false otherwise
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create directory recursively. No-op if already exists.
 * @param path - Directory path
 */
export async function mkdirp(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * List all files recursively under dir. Returns absolute paths only.
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
export async function readDirRecursive(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        files.push(...(await readDirRecursive(full)));
      } else {
        files.push(full);
      }
    }
    return files;
  } catch (err) {
    const e = err as ErrnoLike;
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return [];
    throw new Error(`Failed to read directory ${dir}: ${e.message}. Check permissions.`, {
      cause: err,
    });
  }
}

/**
 * Copy directory recursively preserving structure.
 * @param src - Source directory
 * @param dest - Destination directory
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await mkdirp(dest);
  const entries = await readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const srcPath = join(src, ent.name);
    const destPath = join(dest, ent.name);
    const info = await stat(srcPath);
    if (info.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await mkdirp(dirname(destPath));
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * Ensure .agentsbridgecache symlink exists pointing to the agentsbridge cache dir.
 * Creates or updates the symlink so devs can inspect cached remote extends.
 * @param cacheDir - Absolute path to the cache (e.g. ~/.agentsbridge/cache)
 * @param linkPath - Absolute path where the symlink should live
 */
export async function ensureCacheSymlink(cacheDir: string, linkPath: string): Promise<void> {
  const targetPath = resolve(cacheDir);
  try {
    const info = await lstat(linkPath);
    if (!info.isSymbolicLink()) return; // leave existing non-symlink alone
    const currentTarget = resolve(dirname(linkPath), await readlink(linkPath));
    if (currentTarget === targetPath) return;
    await unlink(linkPath);
  } catch (err) {
    const e = err as ErrnoLike;
    if (e.code !== 'ENOENT') throw err;
  }
  await symlink(targetPath, linkPath, 'dir');
}
