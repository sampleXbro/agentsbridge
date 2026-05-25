/**
 * Sync-mode handler invoked while `.install.lock` is held.
 *
 * Drives `maybeRunInstallSync`: replays every entry under the canonical
 * directory through the injected `recurseInstall` callback, which is the
 * outer `runInstall` minus the lock acquisition (the lock is already held).
 *
 * Returns `undefined` when `sync` is not requested; the caller then proceeds
 * to the single-install code path.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { maybeRunInstallSync } from './install-sync.js';
import type { InstallCommandResult, RunInstallLockedArgs } from './run-install-locked.js';
import type { InstallExecuteResult } from './run-install-execute.js';

export async function handleSync(
  opts: RunInstallLockedArgs,
): Promise<InstallCommandResult | undefined> {
  const { projectRoot, sync, dryRun, force, scope, recurseInstall } = opts;
  if (!sync) return undefined;

  const { context } = await loadScopedConfig(projectRoot, scope);
  const syncInstalled: InstallExecuteResult['installed'] = [];
  const syncSkipped: InstallExecuteResult['skipped'] = [];
  const handled = await maybeRunInstallSync({
    sync,
    canonicalDir: context.canonicalDir,
    reinstall: async (entry) => {
      const replayPaths = entry.paths && entry.paths.length > 0 ? entry.paths : [entry.path];
      for (const replayPath of replayPaths) {
        const result = await recurseInstall(
          {
            ...(force ? { force: true } : {}),
            ...(dryRun ? { 'dry-run': true } : {}),
            ...(scope === 'global' ? { global: true } : {}),
            name: entry.name,
            ...(entry.target ? { target: entry.target } : {}),
            ...(replayPath ? { path: replayPath } : {}),
            ...(entry.as ? { as: entry.as } : {}),
          },
          [entry.source],
          projectRoot,
          { features: entry.features, pick: entry.pick },
        );
        syncInstalled.push(...result.data.installed);
        syncSkipped.push(...result.data.skipped);
      }
    },
  });
  if (!handled) return undefined;
  return {
    exitCode: 0,
    data: {
      source: '',
      mode: 'sync' as const,
      installed: syncInstalled,
      skipped: syncSkipped,
      dryRun,
    },
  };
}
