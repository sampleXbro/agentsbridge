/**
 * Directory-traversal helpers.
 *
 * Separated from `fs.ts` to keep that module under the project's
 * 200-line file budget (CLAUDE.md).
 */
import {
  readdir,
  copyFile,
  stat,
  symlink,
  unlink,
  lstat,
  readlink,
  realpath,
  mkdir,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { FileSystemError } from '../../core/errors.js';

interface ErrnoLike {
  code?: string;
  message: string;
}

const MAX_RECURSIVE_DEPTH = 32;
const MAX_SEGMENT_REPETITIONS = 3;

async function mkdirp(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

function shouldSkipRecursiveBranch(segments: readonly string[]): boolean {
  if (segments.length > MAX_RECURSIVE_DEPTH) return true;
  const counts = new Map<string, number>();
  for (const segment of segments) {
    const count = (counts.get(segment) ?? 0) + 1;
    if (count >= MAX_SEGMENT_REPETITIONS) return true;
    counts.set(segment, count);
  }
  return false;
}

/**
 * List all files recursively under dir. Returns absolute paths only.
 * Skips revisiting the same real directory (breaks symlink cycles).
 */
export async function readDirRecursive(
  dir: string,
  visited?: Set<string>,
  branchSegments?: readonly string[],
): Promise<string[]> {
  const currentBranchSegments = branchSegments ?? [basename(dir)];
  let canonicalDir: string;
  try {
    canonicalDir = await realpath(dir);
  } catch (err) {
    const e = err as ErrnoLike;
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR' || e.code === 'ELOOP') return [];
    throw new FileSystemError(
      dir,
      `Failed to read directory ${dir}: ${e.message}. Check permissions.`,
      { cause: err, errnoCode: e.code },
    );
  }
  const seen = visited ?? new Set<string>();
  if (seen.has(canonicalDir)) return [];
  seen.add(canonicalDir);
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const ent of entries) {
      const full = join(dir, ent.name);
      const walkChild =
        ent.isDirectory() ||
        (ent.isSymbolicLink() &&
          (await stat(full).then(
            (s) => s.isDirectory(),
            () => false,
          )));
      if (walkChild) {
        const nextSegments = [...currentBranchSegments, ent.name];
        if (shouldSkipRecursiveBranch(nextSegments)) continue;
        files.push(...(await readDirRecursive(full, seen, nextSegments)));
      } else {
        files.push(full);
      }
    }
    return files;
  } catch (err) {
    const e = err as ErrnoLike;
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR' || e.code === 'EACCES') return [];
    throw new FileSystemError(
      dir,
      `Failed to read directory ${dir}: ${e.message}. Check permissions.`,
      { cause: err, errnoCode: e.code },
    );
  }
}

/**
 * List all regular files recursively under dir, NOT following symlinks.
 *
 * Differs from `readDirRecursive`: symlinks (to files OR directories) are
 * skipped entirely. Used by the install-manifest hash and uninstall drift
 * detection so a symlinked target outside the pack tree cannot:
 *   - leak external content into the install-time hash, and
 *   - diverge between install (followed) and uninstall (link removed only).
 *
 * Returns absolute paths for regular files only. Directories are walked but
 * not emitted; symlinks are dropped silently.
 */
export async function readDirRecursiveNoSymlinks(
  dir: string,
  branchSegments?: readonly string[],
): Promise<string[]> {
  const currentBranchSegments = branchSegments ?? [basename(dir)];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const ent of entries) {
      if (ent.isSymbolicLink()) continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        const nextSegments = [...currentBranchSegments, ent.name];
        if (shouldSkipRecursiveBranch(nextSegments)) continue;
        files.push(...(await readDirRecursiveNoSymlinks(full, nextSegments)));
      } else if (ent.isFile()) {
        files.push(full);
      }
    }
    return files;
  } catch (err) {
    const e = err as ErrnoLike;
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR' || e.code === 'EACCES') return [];
    throw new FileSystemError(
      dir,
      `Failed to read directory ${dir}: ${e.message}. Check permissions.`,
      { cause: err, errnoCode: e.code },
    );
  }
}

/** Copy directory recursively preserving structure. */
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
 * Ensure .agentsmeshcache symlink exists pointing to the agentsmesh cache dir.
 * Creates or updates the symlink so devs can inspect cached remote extends.
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
