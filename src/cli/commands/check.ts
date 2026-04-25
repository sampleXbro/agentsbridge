/**
 * agentsmesh check — CI integration for team collaboration.
 * Verifies canonical files match the lock file.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { checkLockSync } from '../../core/check/lock-sync.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import { logger } from '../../utils/output/logger.js';

/**
 * Run the check command.
 * @param flags - CLI flags (unused for check)
 * @param projectRoot - Project root (default process.cwd())
 * @returns Exit code: 1 if mismatch or no lock, 0 if OK
 */
export async function runCheck(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<number> {
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
    logger.error("Not initialized for collaboration. Run 'agentsmesh generate' first.");
    return 1;
  }

  if (report.inSync) {
    logger.success('Lock file is in sync.');
    return 0;
  }

  const lockedViolations = new Set(report.lockedViolations);

  logger.error('Conflict detected:');
  for (const p of report.extendsModified) {
    logger.error(`  extend "${p}" was modified`);
  }
  for (const p of report.modified) {
    const suffix = lockedViolations.has(p) ? ' [LOCKED]' : '';
    logger.error(`  ${p} was modified${suffix}`);
  }
  for (const p of report.added) {
    const suffix = lockedViolations.has(p) ? ' [LOCKED]' : '';
    logger.error(`  ${p} was added${suffix}`);
  }
  for (const p of report.removed) {
    const suffix = lockedViolations.has(p) ? ' [LOCKED]' : '';
    logger.error(`  ${p} was removed${suffix}`);
  }
  logger.info(
    "Run 'agentsmesh merge' to resolve, or 'agentsmesh generate --force' to accept current state.",
  );
  return 1;
}
