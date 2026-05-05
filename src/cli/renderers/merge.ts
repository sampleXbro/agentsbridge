/**
 * Human-readable renderer for merge command output.
 */

import { logger } from '../../utils/output/logger.js';
import type { MergeCommandResult } from '../commands/merge.js';

export function renderMerge(result: MergeCommandResult): void {
  if (!result.data.hadConflict) {
    logger.info('No conflicts to resolve.');
    return;
  }
  logger.success('Lock file conflict resolved.');
}
