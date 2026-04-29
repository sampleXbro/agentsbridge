/**
 * File system helpers for agentsmesh.
 */

import {
  readFile,
  writeFile,
  access,
  mkdir,
  rename,
  readdir,
  copyFile,
  rm,
  stat,
  symlink,
  unlink,
  lstat,
  readlink,
  realpath,
} from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { constants } from 'node:fs';
import { FileSystemError } from '../../core/errors.js';

const UTF8_BOM = '\uFEFF';

/**
 * Text-like extensions whose payload must use LF line endings on disk so
 * generated artifacts are byte-stable across Windows/Linux/macOS hosts
 * so generated artifacts are byte-stable across platforms. Anything outside
 * this set is treated as opaque.
 */
const TEXT_EXTENSIONS = new Set<string>([
  '.md',
  '.mdc',
  '.mdx',
  '.markdown',
  '.txt',
  '.json',
  '.jsonc',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.html',
  '.css',
]);

/** Dotfile basenames (no extension) that contain text and should be LF-normalized. */
const TEXT_DOTFILES = new Set<string>([
  '.gitignore',
  '.cursorignore',
  '.cursorindexingignore',
  '.aiignore',
  '.agentignore',
  '.clineignore',
  '.geminiignore',
  '.codeiumignore',
  '.continueignore',
  '.copilotignore',
  '.windsurfignore',
  '.junieignore',
  '.kiroignore',
  '.rooignore',
  '.antigravityignore',
]);

function shouldNormalizeLineEndings(path: string): boolean {
  const ext = extname(path).toLowerCase();
  if (ext.length > 0) return TEXT_EXTENSIONS.has(ext);
  const base = basename(path).toLowerCase();
  return TEXT_DOTFILES.has(base);
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

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
 */
export async function writeFileAtomic(path: string, content: string): Promise<void> {
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
      // link target. This closes the TOCTOU window where a symlink could be
      // swapped in between guard and rename to redirect writes outside the tree.
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
  try {
    try {
      const tmpInfo = await lstat(tmpPath);
      if (tmpInfo.isSymbolicLink()) {
        await unlink(tmpPath);
      }
    } catch (tmpErr) {
      if ((tmpErr as ErrnoLike).code !== 'ENOENT') throw tmpErr;
    }
    await writeFile(tmpPath, payload, { encoding: 'utf-8', flag: 'w' });
    await rename(tmpPath, path);
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
 * Skips revisiting the same real directory (breaks symlink cycles).
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
export async function readDirRecursive(dir: string, visited?: Set<string>): Promise<string[]> {
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
        files.push(...(await readDirRecursive(full, seen)));
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
 * Ensure .agentsmeshcache symlink exists pointing to the agentsmesh cache dir.
 * Creates or updates the symlink so devs can inspect cached remote extends.
 * @param cacheDir - Absolute path to the cache (e.g. ~/.agentsmesh/cache)
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
