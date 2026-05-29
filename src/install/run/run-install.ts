/**
 * agentsmesh install orchestration.
 *
 * Acquires the install/uninstall lock for the current canonical dir, then
 * delegates the locked body to `runInstallLocked` (split out to keep this
 * file under the 200-line cap).
 *
 * Sync replay calls `runInstall` recursively for each saved entry. The
 * outer call already holds the lock, so the recursive calls (signaled by
 * `replay` being set) must skip re-acquisition to avoid self-deadlock.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { readInstallFlags } from '../core/install-flags.js';
import { acquireInstallLock } from '../lock/install-lock.js';
import { runInstallLocked, type InstallCommandResult } from './run-install-locked.js';
import { type InstallReplayScope } from './install-replay.js';
import type { LockRelease } from '../../utils/filesystem/process-lock.js';

export type { InstallCommandResult } from './run-install-locked.js';

export async function runInstall(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
  replay?: InstallReplayScope,
): Promise<InstallCommandResult> {
  const {
    sync,
    dryRun,
    force,
    useExtends,
    all,
    forceFreshMaterialize,
    explicitPath,
    explicitTarget,
    explicitAs,
    nameOverride,
    acceptHooks,
    acceptPermissions,
    acceptMcp,
  } = readInstallFlags(flags);
  const scope = flags.global === true ? 'global' : 'project';
  const sourceArg = args[0]?.trim();

  let lockRelease: LockRelease | undefined;
  if (replay === undefined) {
    const { context } = await loadScopedConfig(projectRoot, scope);
    lockRelease = await acquireInstallLock(context.canonicalDir);
  }

  try {
    return await runInstallLocked({
      args,
      projectRoot,
      replay,
      sync,
      dryRun,
      force,
      useExtends,
      all,
      forceFreshMaterialize,
      explicitPath,
      explicitTarget,
      explicitAs,
      nameOverride,
      acceptHooks,
      acceptPermissions,
      acceptMcp,
      scope,
      sourceArg,
      recurseInstall: runInstall,
    });
  } finally {
    await lockRelease?.();
  }
}
