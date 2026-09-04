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
import { diffOutputChecksums } from '../../config/core/lock-outputs.js';
import {
  findStaleGeneratedOutputs,
  findUntrackedManagedDirFiles,
} from '../generate/stale-cleanup.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

export interface LockSyncReport {
  /** True when canonical state and checked generated outputs are all in sync. */
  readonly inSync: boolean;
  /** True when a `.lock` file was found at the canonical directory. */
  readonly hasLock: boolean;
  /** True when canonical files or extends differ from the lock. */
  readonly canonicalDrift: boolean;
  /** True when a generated output is modified, removed, or stale. */
  readonly outputDrift: boolean;
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
  /** Generated outputs whose on-disk hash differs from the lock. */
  readonly outputsModified: readonly string[];
  /** Generated outputs recorded in the lock but missing from disk. */
  readonly outputsRemoved: readonly string[];
  /** Managed generated outputs present on disk but absent from the lock. */
  readonly outputsStale: readonly string[];
  /**
   * Files inside a managed directory the lock does not claim — the tool's own
   * output or something hand-authored. Informational: deliberately excluded
   * from `outputDrift` and `inSync`, because `generate` cannot remove them.
   */
  readonly outputsUntracked: readonly string[];
  /**
   * True when output drift was actually verified — requires `rootBase` and a
   * lock with an `outputs` map. False for old-format locks or when no
   * `rootBase` was supplied.
   */
  readonly outputsChecked: boolean;
}

export interface CheckLockSyncOptions {
  readonly config: ValidatedConfig;
  /** Directory containing `agentsmesh.yaml` (used to resolve relative extends). */
  readonly configDir: string;
  /** Directory containing `.agentsmesh/.lock` and canonical files. */
  readonly canonicalDir: string;
  /**
   * Project root the generated outputs are relative to. When absent, output
   * verification is skipped (keeps the programmatic API backward compatible).
   */
  readonly rootBase?: string;
  /** Output-layout scope used when scanning managed locations for stale files. */
  readonly scope?: TargetLayoutScope;
}

/**
 * Compare the lock file at `canonicalDir/.lock` against the current canonical
 * state and resolved extends. Pure: no logging, no exit codes.
 *
 * Returns `hasLock: false` and `inSync: false` when no lock is present —
 * callers decide whether that's a hard error (CI) or just informational.
 */
export async function checkLockSync(opts: CheckLockSyncOptions): Promise<LockSyncReport> {
  const { config, configDir, canonicalDir, rootBase, scope = 'project' } = opts;

  const lock = await readLock(canonicalDir);
  if (lock === null) {
    return {
      inSync: false,
      hasLock: false,
      canonicalDrift: false,
      outputDrift: false,
      modified: [],
      added: [],
      removed: [],
      extendsModified: [],
      lockedViolations: [],
      outputsModified: [],
      outputsRemoved: [],
      outputsStale: [],
      outputsUntracked: [],
      outputsChecked: false,
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

  // Output verification runs only when a rootBase is supplied AND the lock
  // carries an outputs map (old-format locks leave `lock.outputs` undefined).
  const outputsChecked = rootBase !== undefined && lock.outputs !== undefined;
  const { outputsModified, outputsRemoved } = outputsChecked
    ? await diffOutputChecksums(rootBase, lock.outputs ?? {})
    : { outputsModified: [], outputsRemoved: [] };

  // `generatedOutputs` is the same map as `expectedPaths` here, and that is the
  // point: a file discovered under a managed DIRECTORY is only a generated
  // output if the lock says agentsmesh wrote it. Without this gate the sweep
  // reports the tool's own files — a hook Kiro wrote into `.kiro/hooks` — as
  // stale generated output, and neither remedy the CLI prints can clear it.
  // Static `managedOutputs.files` entries stay ungated, so a genuinely stale
  // owned artifact is still caught.
  const outputsStale =
    rootBase !== undefined && lock.outputs !== undefined
      ? await findStaleGeneratedOutputs({
          projectRoot: rootBase,
          targets: [...config.targets, ...(config.pluginTargets ?? [])],
          expectedPaths: Object.keys(lock.outputs),
          generatedOutputs: Object.keys(lock.outputs),
          scope,
        })
      : [];

  const outputsUntracked =
    rootBase !== undefined && lock.outputs !== undefined
      ? await findUntrackedManagedDirFiles({
          projectRoot: rootBase,
          targets: [...config.targets, ...(config.pluginTargets ?? [])],
          expectedPaths: Object.keys(lock.outputs),
          generatedOutputs: Object.keys(lock.outputs),
          scope,
        })
      : [];

  const canonicalDrift =
    modified.length > 0 || added.length > 0 || removed.length > 0 || extendsModified.length > 0;
  const outputDrift =
    outputsModified.length > 0 || outputsRemoved.length > 0 || outputsStale.length > 0;
  const inSync = !canonicalDrift && !outputDrift;

  return {
    inSync,
    hasLock: true,
    canonicalDrift,
    outputDrift,
    modified,
    added,
    removed,
    extendsModified,
    lockedViolations,
    outputsModified,
    outputsRemoved,
    outputsStale,
    outputsUntracked,
    outputsChecked,
  };
}
