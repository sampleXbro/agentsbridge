/**
 * Compare an installed pack directory against its install-time manifest
 * `files` map and report per-file drift before uninstall.
 *
 * Drift categories:
 *   - `modified`: file is present on disk and in the manifest, but the
 *     current sha256 differs from the recorded one.
 *   - `deleted`: file is in the manifest but missing from disk.
 *   - `added`: file exists on disk but is not in the manifest (user added
 *     supporting material after install).
 *
 * `pack.yaml` and `.agentsmesh-install-manifest.json` are excluded from the
 * comparison to match `hashPackFiles`, so metadata churn never registers as
 * drift.
 *
 * Pure: emits structured drift entries; does not write, prompt, or read the
 * manifest from disk. Legacy packs (no manifest file at all) are handled
 * upstream by `legacy-manifest-migration` and never reach this helper.
 */

import { relative } from 'node:path';
import { readDirRecursiveNoSymlinks } from '../../utils/filesystem/fs.js';
import { hashFileForManifest } from '../../utils/crypto/hash.js';
import { INSTALL_MANIFEST_FILENAME } from '../manifest/install-manifest-hash.js';

export type ModificationStatus = 'modified' | 'deleted' | 'added';

export interface ModifiedFile {
  readonly relativePath: string;
  readonly status: ModificationStatus;
}

const EXCLUDED_FILENAMES: readonly string[] = ['pack.yaml', INSTALL_MANIFEST_FILENAME];

function toForwardSlashRelative(packDir: string, abs: string): string {
  return relative(packDir, abs).replaceAll('\\', '/');
}

/**
 * Compute drift between `packDir` (current on-disk state) and
 * `manifestFiles` (the `files` map recorded at install time).
 *
 * @param packDir - Absolute path to the installed pack directory.
 * @param manifestFiles - `relativePath -> "sha256:<hex>"` map from the install manifest.
 * @returns Drift entries sorted ascending by `relativePath`.
 */
export async function detectModifiedFiles(
  packDir: string,
  manifestFiles: Readonly<Record<string, string>>,
): Promise<ModifiedFile[]> {
  // Match `hashPackFiles`: ignore symlinks so a link inside the pack does not
  // diverge between install (followed) and uninstall (link removed only).
  const onDiskAbs = await readDirRecursiveNoSymlinks(packDir);
  const onDisk = new Map<string, string>();
  for (const abs of onDiskAbs) {
    const rel = toForwardSlashRelative(packDir, abs);
    if (EXCLUDED_FILENAMES.includes(rel)) continue;
    onDisk.set(rel, abs);
  }

  const results: ModifiedFile[] = [];

  for (const [rel, expectedHash] of Object.entries(manifestFiles)) {
    const abs = onDisk.get(rel);
    if (abs === undefined) {
      results.push({ relativePath: rel, status: 'deleted' });
      continue;
    }
    const hex = await hashFileForManifest(abs);
    if (hex === null) {
      // `hashFile` returns null only for ENOENT (other I/O errors throw).
      // The file existed at `readDirRecursive` but is gone now — a raced
      // deletion. Under the install lock no other agentsmesh process can
      // race us, so this realistically only fires when an external tool
      // unlinks the file mid-uninstall. Folding into `deleted` is correct:
      // the file is gone from disk, the user will see it reported, and
      // `delete-anyway` is still safe (`rm -rf` on a missing file is a
      // no-op).
      results.push({ relativePath: rel, status: 'deleted' });
      continue;
    }
    const actualHash = `sha256:${hex}`;
    if (actualHash !== expectedHash) {
      results.push({ relativePath: rel, status: 'modified' });
    }
  }

  for (const rel of onDisk.keys()) {
    if (!(rel in manifestFiles)) {
      results.push({ relativePath: rel, status: 'added' });
    }
  }

  results.sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  );
  return results;
}
