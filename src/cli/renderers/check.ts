/**
 * Human-readable renderer for check command output.
 */

import { logger } from '../../utils/output/logger.js';
import type { CheckCommandResult } from '../commands/check.js';

export function renderCheck(result: CheckCommandResult): void {
  const { data } = result;

  if (!data.hasLock) {
    logger.error("Not initialized for collaboration. Run 'agentsmesh generate' first.");
    return;
  }

  if (data.inSync) {
    logger.success('Lock file is in sync.');
    return;
  }

  const lockedSet = new Set(data.lockedViolations);
  logger.error('Conflict detected:');
  for (const p of data.extendsModified) {
    logger.error(`  extend "${p}" was modified`);
  }
  for (const p of data.modified) {
    const suffix = lockedSet.has(p) ? ' [LOCKED]' : '';
    logger.error(`  ${p} was modified${suffix}`);
  }
  for (const p of data.added) {
    const suffix = lockedSet.has(p) ? ' [LOCKED]' : '';
    logger.error(`  ${p} was added${suffix}`);
  }
  for (const p of data.removed) {
    const suffix = lockedSet.has(p) ? ' [LOCKED]' : '';
    logger.error(`  ${p} was removed${suffix}`);
  }
  logger.info(
    "Run 'agentsmesh merge' to resolve, or 'agentsmesh generate --force' to accept current state.",
  );
}
