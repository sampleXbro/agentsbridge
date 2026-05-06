/**
 * agentsmesh merge — resolve git merge conflicts in .agentsmesh/.lock.
 * Rebuilds lock checksums from current canonical files when conflict markers present.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { hasLockConflict, resolveLockConflict } from '../../core/merger.js';
import { getVersion } from '../version.js';
import type { MergeData } from '../command-result.js';

export interface MergeCommandResult {
  exitCode: number;
  data: MergeData;
}

/**
 * Run the merge command.
 * @param flags - CLI flags (--global selects global scope)
 * @param projectRoot - Project root (default process.cwd())
 * @returns Structured merge result with exit code and conflict data
 */
export async function runMerge(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<MergeCommandResult> {
  const root = projectRoot ?? process.cwd();
  const scope = flags.global === true ? 'global' : 'project';

  const { config, context } = await loadScopedConfig(root, scope);
  const abDir = context.canonicalDir;

  const hasConflict = await hasLockConflict(abDir);
  if (!hasConflict) {
    return { exitCode: 0, data: { hadConflict: false, resolved: false } };
  }

  await resolveLockConflict(abDir, getVersion(), config);
  return { exitCode: 0, data: { hadConflict: true, resolved: true } };
}
