/**
 * Human-readable renderer for diff command output.
 */

import { logger } from '../../utils/output/logger.js';
import { formatDiffSummary } from '../../core/differ.js';
import type { DiffCommandResult } from '../commands/diff.js';

export function renderDiff(result: DiffCommandResult): void {
  const { summary } = result.data;
  const total = summary.created + summary.updated + summary.unchanged + summary.deleted;

  if (total === 0) {
    logger.info('No files to generate (no root rule or rules feature disabled).');
    return;
  }

  for (const p of result.data.patches) {
    process.stdout.write(p.patch);
  }
  logger.info(
    formatDiffSummary({
      new: summary.created,
      updated: summary.updated,
      unchanged: summary.unchanged,
      deleted: summary.deleted,
    }),
  );
}
