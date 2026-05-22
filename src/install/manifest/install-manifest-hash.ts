/**
 * Per-file SHA-256 hashing for the install-time integrity manifest.
 *
 * Produces the `files` map written to `.agentsmesh-install-manifest.json`
 * alongside the pack at install time. Uninstall (P10+) re-hashes the same
 * files and compares against this map to surface user modifications before
 * blindly deleting a pack.
 *
 * The aggregate `pack.yaml` `content_hash` (computed by `pack-hash.ts`)
 * fingerprints the whole pack as one string for tamper detection. This
 * helper is complementary: it exposes the same evidence one file at a time,
 * so modification reports can name specific files.
 *
 * `pack.yaml` and the manifest file itself are excluded from the map so
 * metadata churn never registers as content drift.
 */

import { relative } from 'node:path';
import { readDirRecursiveNoSymlinks } from '../../utils/filesystem/fs.js';
import { hashFileForManifest } from '../../utils/crypto/hash.js';

export const INSTALL_MANIFEST_FILENAME = '.agentsmesh-install-manifest.json';

const EXCLUDED_FILENAMES: readonly string[] = ['pack.yaml', INSTALL_MANIFEST_FILENAME];

function toForwardSlashRelative(packDir: string, abs: string): string {
  return relative(packDir, abs).replaceAll('\\', '/');
}

/**
 * Compute a deterministic per-file hash map for everything under `packDir`,
 * excluding `pack.yaml` and `.agentsmesh-install-manifest.json`.
 *
 * Keys are forward-slash relative paths sorted ascending; values are
 * `sha256:<64-hex>` strings.
 */
export async function hashPackFiles(packDir: string): Promise<Record<string, string>> {
  // No-symlinks variant: a symlinked file inside a pack would let install
  // hash the resolved target (and silently absorb external bytes), then at
  // uninstall the recursive `rm` would only delete the link itself —
  // producing a permanent drift-detection mismatch. Skip symlinks so install
  // and uninstall see the exact same byte universe.
  const files = await readDirRecursiveNoSymlinks(packDir);
  const entries: Array<[string, string]> = [];

  for (const abs of files) {
    const rel = toForwardSlashRelative(packDir, abs);
    if (EXCLUDED_FILENAMES.includes(rel)) continue;
    const hex = await hashFileForManifest(abs);
    if (hex === null) continue;
    entries.push([rel, `sha256:${hex}`]);
  }

  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}
