/**
 * Human-readable renderer for `agentsmesh distill`.
 */

import { relative } from 'node:path';
import { logger } from '../../utils/output/logger.js';
import type { DistillCommandResult } from '../commands/distill.js';

export function renderDistill(result: DistillCommandResult): void {
  const data = result.data;
  if (data.mode === 'propose') {
    if (data.proposalFile === null) {
      logger.success('No new bullets to distill.');
      return;
    }
    const rel = relative(process.cwd(), data.proposalFile).replaceAll('\\', '/');
    logger.success(`Wrote ${data.proposalCount} proposal(s) to ${rel}.`);
    logger.info(
      "Review decisions, then run 'agentsmesh distill --apply' to record them in the ledger.",
    );
    return;
  }
  if (data.mode === 'apply') {
    logger.success(`Applied. ${data.routed} bullet(s) routed, ${data.skipped} skipped.`);
    logger.info(
      'Ledger updated. Topic Rules sections are author-maintained — edit them manually if a new bullet teaches a new rule.',
    );
    return;
  }
  // check
  if (data.unrouted.length === 0) {
    logger.success(`all ${data.checked} journal bullets routed`);
    return;
  }
  logger.error(`${data.unrouted.length} unrouted bullet(s):`);
  for (const bullet of data.unrouted) {
    logger.error(`  L${bullet.lineNumber}  ${bullet.preview}`);
  }
  logger.info("Run 'agentsmesh distill' → review proposal → 'agentsmesh distill --apply'.");
}
