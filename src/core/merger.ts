/**
 * Resolve git merge conflicts in .agentsbridge/.lock.
 * When .lock has conflict markers, rebuilds checksums from current canonical files.
 */

import { dirname, join } from 'node:path';
import { readFileSafe } from '../utils/fs.js';
import {
  buildChecksums,
  buildExtendChecksums,
  buildPackChecksums,
  writeLock,
} from '../config/lock.js';
import type { ValidatedConfig } from '../config/schema.js';
import { resolveExtendPaths } from '../config/resolver.js';

const LOCK_FILENAME = '.lock';
const CONFLICT_MARKER = '<<<<<<<';

/**
 * Check if the lock file contains git merge conflict markers.
 * @param abDir - Absolute path to .agentsbridge
 * @returns True if lock has conflict markers
 */
export async function hasLockConflict(abDir: string): Promise<boolean> {
  const lockPath = join(abDir, LOCK_FILENAME);
  const content = await readFileSafe(lockPath);
  if (content === null) return false;
  return content.includes(CONFLICT_MARKER);
}

/**
 * Resolve lock conflict by rebuilding checksums from current canonical files.
 * Assumes user has already resolved conflicted canonical files (e.g. via git/editor).
 * @param abDir - Absolute path to .agentsbridge
 * @param libVersion - Library version for the new lock
 * @param config - Optional config for extend checksums
 * @throws Error if lock has no conflict or does not exist
 */
export async function resolveLockConflict(
  abDir: string,
  libVersion: string,
  config?: ValidatedConfig,
): Promise<void> {
  const hasConflict = await hasLockConflict(abDir);
  if (!hasConflict) {
    throw new Error('No conflict to resolve.');
  }

  const checksums = await buildChecksums(abDir);
  const configDir = dirname(abDir);
  const resolvedExtends = config ? await resolveExtendPaths(config, configDir) : [];
  const extendChecksums =
    resolvedExtends.length > 0 ? await buildExtendChecksums(resolvedExtends) : {};
  const packChecksums = await buildPackChecksums(join(abDir, 'packs'));
  const generatedBy = process.env['USER'] ?? process.env['USERNAME'] ?? 'unknown';

  await writeLock(abDir, {
    generatedAt: new Date().toISOString(),
    generatedBy,
    libVersion,
    checksums,
    extends: extendChecksums,
    packs: packChecksums,
  });
}
