/**
 * agentsmesh check — CI integration for team collaboration.
 * Verifies canonical files match the lock file.
 */

import { join } from 'node:path';
import { loadConfigFromDir } from '../../config/core/loader.js';
import { resolveExtendPaths } from '../../config/resolve/resolver.js';
import {
  readLock,
  buildChecksums,
  buildExtendChecksums,
  detectLockedFeatureViolations,
} from '../../config/core/lock.js';
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
  void flags;
  const root = projectRoot ?? process.cwd();

  const { config, configDir } = await loadConfigFromDir(root);
  const abDir = join(configDir, '.agentsmesh');

  const lock = await readLock(abDir);
  if (lock === null) {
    logger.error("Not initialized for collaboration. Run 'agentsmesh generate' first.");
    return 1;
  }

  const current = await buildChecksums(abDir);
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
  const extendModified: string[] = [];
  for (const name of extendNames) {
    const c = currentExtends[name];
    const l = lock.extends[name];
    if (c !== l) {
      extendModified.push(name);
    }
  }

  if (
    modified.length === 0 &&
    added.length === 0 &&
    removed.length === 0 &&
    extendModified.length === 0
  ) {
    logger.success('Lock file is in sync.');
    return 0;
  }

  const lockedViolations = new Set(
    detectLockedFeatureViolations(
      lock.checksums,
      current,
      config.collaboration?.lock_features ?? [],
    ),
  );

  logger.error('Conflict detected:');
  for (const p of extendModified) {
    logger.error(`  extend "${p}" was modified`);
  }
  for (const p of modified) {
    const suffix = lockedViolations.has(p) ? ' [LOCKED]' : '';
    logger.error(`  ${p} was modified${suffix}`);
  }
  for (const p of added) {
    const suffix = lockedViolations.has(p) ? ' [LOCKED]' : '';
    logger.error(`  ${p} was added${suffix}`);
  }
  for (const p of removed) {
    const suffix = lockedViolations.has(p) ? ' [LOCKED]' : '';
    logger.error(`  ${p} was removed${suffix}`);
  }
  logger.info(
    "Run 'agentsmesh merge' to resolve, or 'agentsmesh generate --force' to accept current state.",
  );
  return 1;
}
