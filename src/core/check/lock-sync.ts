/**
 * Pure lock-vs-current drift detection used by `agentsmesh check` and the
 * public Programmatic API. The CLI command formats and exits; this helper
 * returns a structured report.
 */

import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  buildChecksums,
  buildExtendChecksums,
  detectLockedFeatureViolations,
  readLock,
} from '../../config/core/lock.js';
import { resolveExtendPaths } from '../../config/resolve/resolver.js';

export interface LockSyncReport {
  /** True when the canonical state matches the lock file and no extend drifted. */
  readonly inSync: boolean;
  /** True when a `.lock` file was found at the canonical directory. */
  readonly hasLock: boolean;
  /** Canonical files whose checksum differs from the lock. */
  readonly modified: readonly string[];
  /** Canonical files present now but not in the lock. */
  readonly added: readonly string[];
  /** Canonical files in the lock but missing now. */
  readonly removed: readonly string[];
  /** Extend names whose pinned version/checksum differs from the lock. */
  readonly extendsModified: readonly string[];
  /**
   * Subset of `modified ∪ added ∪ removed` that violates
   * `collaboration.lock_features`. Empty when no `lock_features` are configured.
   */
  readonly lockedViolations: readonly string[];
}

export interface CheckLockSyncOptions {
  readonly config: ValidatedConfig;
  /** Directory containing `agentsmesh.yaml` (used to resolve relative extends). */
  readonly configDir: string;
  /** Directory containing `.agentsmesh/.lock` and canonical files. */
  readonly canonicalDir: string;
}

/**
 * Compare the lock file at `canonicalDir/.lock` against the current canonical
 * state and resolved extends. Pure: no logging, no exit codes.
 *
 * Returns `hasLock: false` and `inSync: false` when no lock is present —
 * callers decide whether that's a hard error (CI) or just informational.
 */
export async function checkLockSync(opts: CheckLockSyncOptions): Promise<LockSyncReport> {
  const { config, configDir, canonicalDir } = opts;

  const lock = await readLock(canonicalDir);
  if (lock === null) {
    return {
      inSync: false,
      hasLock: false,
      modified: [],
      added: [],
      removed: [],
      extendsModified: [],
      lockedViolations: [],
    };
  }

  const current = await buildChecksums(canonicalDir);
  const resolvedExtends = await resolveExtendPaths(config, configDir);
  const currentExtends =
    resolvedExtends.length > 0 ? await buildExtendChecksums(resolvedExtends) : {};

  const lockPaths = new Set(Object.keys(lock.checksums));
  const currentPaths = new Set(Object.keys(current));

  const modified: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const path of lockPaths) {
    const c = current[path];
    if (c === undefined) {
      removed.push(path);
    } else if (c !== lock.checksums[path]) {
      modified.push(path);
    }
  }
  for (const path of currentPaths) {
    if (!lockPaths.has(path)) {
      added.push(path);
    }
  }

  const extendNames = new Set([...Object.keys(lock.extends), ...Object.keys(currentExtends)]);
  const extendsModified: string[] = [];
  for (const name of extendNames) {
    if (currentExtends[name] !== lock.extends[name]) {
      extendsModified.push(name);
    }
  }

  const lockedViolations = detectLockedFeatureViolations(
    lock.checksums,
    current,
    config.collaboration?.lock_features ?? [],
  );

  const inSync =
    modified.length === 0 &&
    added.length === 0 &&
    removed.length === 0 &&
    extendsModified.length === 0;

  return {
    inSync,
    hasLock: true,
    modified,
    added,
    removed,
    extendsModified,
    lockedViolations,
  };
}
