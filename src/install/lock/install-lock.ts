/**
 * Process lock for install and uninstall operations.
 *
 * Mirrors the `.generate.lock` pattern used by `agentsmesh generate` so that
 * `install` and `uninstall` cannot race against each other (and against
 * each other across multiple invocations) on the same project. The lock
 * lives at `<canonicalDir>/.install.lock` and is acquired via the shared
 * `acquireProcessLock` primitive — same stale-eviction, signal-handler
 * cleanup, and PID metadata as `.generate.lock`.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  acquireProcessLock,
  type LockOptions,
  type LockRelease,
} from '../../utils/filesystem/process-lock.js';

export const INSTALL_LOCK_FILENAME = '.install.lock';

/**
 * Acquire the install/uninstall lock for the given canonical directory.
 *
 * Ensures `canonicalDir` exists first: on a first-time `agentsmesh install`,
 * the project has no `.agentsmesh/` yet, so `acquireProcessLock` would fail
 * with ENOENT when writing the lockfile under a missing parent.
 *
 * @param canonicalDir - The `.agentsmesh/` directory (project) or `~/.agentsmesh/` (global) hosting the lock.
 * @param opts - Optional retry/stale tuning passed through to `acquireProcessLock`.
 * @returns A release function; callers must invoke it in a `finally` block.
 * @throws {LockAcquisitionError} if the lock cannot be acquired within the retry budget.
 */
export async function acquireInstallLock(
  canonicalDir: string,
  opts: LockOptions = {},
): Promise<LockRelease> {
  await mkdir(canonicalDir, { recursive: true });
  return acquireProcessLock(join(canonicalDir, INSTALL_LOCK_FILENAME), opts);
}
