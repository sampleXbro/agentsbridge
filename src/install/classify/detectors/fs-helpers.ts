/**
 * Filesystem primitives shared across structural layout detectors.
 *
 * These helpers swallow ENOENT / ENOTDIR / EACCES because detection runs
 * against arbitrary user input — a missing dir is a normal "not detected"
 * signal, not an error.
 */

import { readdir, stat } from 'node:fs/promises';
import type { FileShape } from '../layout-types.js';

export interface DirEntryLite {
  readonly name: string;
  readonly isDir: boolean;
  readonly isFile: boolean;
}

export async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function listDirEntries(dir: string): Promise<ReadonlyArray<DirEntryLite>> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory(), isFile: e.isFile() }));
  } catch {
    return [];
  }
}

export function classifyFileShape(name: string): FileShape | null {
  if (name.endsWith('.instructions.md')) return 'copilot-instructions';
  if (name.endsWith('.md')) return 'md';
  if (name.endsWith('.mdc')) return 'mdc';
  if (name.endsWith('.toml')) return 'toml';
  return null;
}
