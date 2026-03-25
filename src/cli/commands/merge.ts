/**
 * agentsbridge merge — resolve git merge conflicts in .agentsbridge/.lock.
 * Rebuilds lock checksums from current canonical files when conflict markers present.
 */

import { join } from 'node:path';
import { loadConfigFromDir } from '../../config/loader.js';
import { hasLockConflict, resolveLockConflict } from '../../core/merger.js';
import { getVersion } from '../version.js';
import { logger } from '../../utils/logger.js';

/**
 * Run the merge command.
 * @param flags - CLI flags (unused for merge)
 * @param projectRoot - Project root (default process.cwd())
 */
export async function runMerge(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<void> {
  void flags;
  const root = projectRoot ?? process.cwd();

  const { config, configDir } = await loadConfigFromDir(root);
  const abDir = join(configDir, '.agentsbridge');

  const hasConflict = await hasLockConflict(abDir);
  if (!hasConflict) {
    logger.info('No conflicts to resolve.');
    return;
  }

  await resolveLockConflict(abDir, getVersion(), config);
  logger.success('Lock file conflict resolved.');
}
