/**
 * File system helpers for agentsmesh: atomic write/read/exists/mkdirp.
 * Traversal helpers live in `fs-traverse.ts`; text-encoding helpers in
 * `fs-text-encoding.ts`. Re-exports keep the public API stable.
 */

import {
  readFile,
  writeFile,
  access,
  chmod,
  mkdir,
  rename,
  rm,
  unlink,
  lstat,
} from 'node:fs/promises';
import { dirname } from 'node:path';
import { constants } from 'node:fs';
import { FileSystemError } from '../../core/errors.js';
import {
  UTF8_BOM,
  executableModeFor,
  normalizeLineEndings,
  shouldNormalizeLineEndings,
} from './fs-text-encoding.js';

export {
  copyDir,
  ensureCacheSymlink,
  readDirRecursive,
  readDirRecursiveNoSymlinks,
} from './fs-traverse.js';
export { executableModeFor } from './fs-text-encoding.js';

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
    throw new FileSystemError(
      path,
      `Failed to read ${path}: ${e.message}. Ensure the file exists and is readable.`,
      { cause: err, errnoCode: e.code },
    );
  }
}

/**
 * Write content atomically (write to .tmp, then rename).
 * Creates parent directories.
 *
 * Symlink safety: refuses to follow a pre-existing symlink at `path`. Without
 * this guard, an attacker with write access to the parent directory could swap
 * `path` for a symlink between the lstat check and the rename, redirecting the
 * write to an arbitrary destination (e.g. `~/.ssh/authorized_keys`). On detect,
 * the existing symlink is unlinked so the new file lands at the intended path.
 *
 * @param path - Target file path
 * @param content - Content to write
 * @param options - Optional `mode` (POSIX permission bits). When omitted, the
 *   mode is inferred from the path extension via `executableModeFor`; passing
 *   an explicit value overrides that inference.
 */
export async function writeFileAtomic(
  path: string,
  content: string,
  options?: { mode?: number },
): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  try {
    const info = await lstat(path);
    if (info.isDirectory()) {
      throw new FileSystemError(
        path,
        `Failed to write ${path}: target exists and is a directory. Remove it or choose a different path.`,
        { errnoCode: 'EISDIR' },
      );
    }
    if (info.isSymbolicLink()) {
      // Drop the symlink so the rename below lands at `path` itself, not at the
      // link target. Closes a TOCTOU window where a symlink could be swapped in
      // between guard and rename to redirect writes outside the tree.
      await unlink(path).catch((e: unknown) => {
        if ((e as ErrnoLike).code !== 'ENOENT') throw e;
      });
    }
  } catch (err) {
    if (err instanceof FileSystemError) throw err;
    const e = err as ErrnoLike;
    if (e.code !== 'ENOENT') throw err;
  }
  const tmpPath = `${path}.tmp`;
  const payload = shouldNormalizeLineEndings(path) ? normalizeLineEndings(content) : content;
  const mode = options?.mode ?? executableModeFor(path);
  try {
    try {
      const tmpInfo = await lstat(tmpPath);
      if (tmpInfo.isSymbolicLink()) {
        await unlink(tmpPath);
      }
    } catch (tmpErr) {
      if ((tmpErr as ErrnoLike).code !== 'ENOENT') throw tmpErr;
    }
    const writeOpts: NonNullable<Parameters<typeof writeFile>[2]> = {
      encoding: 'utf-8',
      flag: 'w',
    };
    if (mode !== undefined) (writeOpts as { mode?: number }).mode = mode;
    await writeFile(tmpPath, payload, writeOpts);
    await rename(tmpPath, path);
    if (mode !== undefined) {
      // `writeFile`'s mode only applies on initial create; if tmp already
      // existed (or umask masked some bits) we'd silently drop the executable
      // bit. chmod after rename guarantees the final inode carries the mode.
      await chmod(path, mode);
    }
  } catch (err) {
    await rm(tmpPath, { force: true }).catch(() => {});
    const e = err as ErrnoLike;
    throw new FileSystemError(
      path,
      `Failed to write ${path}: ${e.message}. Check permissions and disk space.`,
      { cause: err, errnoCode: e.code },
    );
  }
}

/** Check if path exists. */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Create directory recursively. No-op if already exists. */
export async function mkdirp(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}
