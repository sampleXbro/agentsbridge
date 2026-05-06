/**
 * agentsmesh check — CI integration for team collaboration.
 * Verifies canonical files match the lock file.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { checkLockSync } from '../../core/check/lock-sync.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import type { CheckData } from '../command-result.js';

export interface CheckCommandResult {
  exitCode: number;
  data: CheckData;
}

/**
 * Run the check command.
 * @param flags - CLI flags (unused for check)
 * @param projectRoot - Project root (default process.cwd())
 * @returns Structured check result with exit code and data
 */
export async function runCheck(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<CheckCommandResult> {
  const root = projectRoot ?? process.cwd();
  const scope = flags.global === true ? 'global' : 'project';

  const { config, context } = await loadScopedConfig(root, scope);
  await bootstrapPlugins(config, root);

  const report = await checkLockSync({
    config,
    configDir: context.configDir,
    canonicalDir: context.canonicalDir,
  });

  if (!report.hasLock) {
    return {
      exitCode: 1,
      data: {
        hasLock: false,
        inSync: false,
        modified: [],
        added: [],
        removed: [],
        extendsModified: [],
        lockedViolations: [],
      },
    };
  }

  return {
    exitCode: report.inSync ? 0 : 1,
    data: {
      hasLock: true,
      inSync: report.inSync,
      modified: [...report.modified],
      added: [...report.added],
      removed: [...report.removed],
      extendsModified: [...report.extendsModified],
      lockedViolations: [...report.lockedViolations],
    },
  };
}
