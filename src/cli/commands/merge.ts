/**
 * agentsmesh merge — resolve git merge conflicts in .agentsmesh/.lock.
 * Rebuilds lock checksums from current canonical files when conflict markers present.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { hasLockConflict, resolveLockConflict } from '../../core/merger.js';
import { getVersion } from '../version.js';
import { logger } from '../../utils/output/logger.js';

/**
 * Run the merge command.
 * @param flags - CLI flags (unused for merge)
 * @param projectRoot - Project root (default process.cwd())
 */
export async function runMerge(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<void> {
  const root = projectRoot ?? process.cwd();
  const scope = flags.global === true ? 'global' : 'project';

  const { config, context } = await loadScopedConfig(root, scope);
  const abDir = context.canonicalDir;

  const hasConflict = await hasLockConflict(abDir);
  if (!hasConflict) {
    logger.info('No conflicts to resolve.');
    return;
  }

  await resolveLockConflict(abDir, getVersion(), config);
  logger.success('Lock file conflict resolved.');
}
