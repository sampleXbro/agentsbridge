/**
 * Human-readable renderer for `agentsmesh refresh`. Mirrors the
 * install/uninstall renderer style: per-line summary, forward-slash paths only.
 */

import { logger } from '../../utils/output/logger.js';
import type { RefreshCommandResult } from '../../install/refresh/refresh-result.js';

export function renderRefresh(result: RefreshCommandResult): void {
  const { data } = result;

  if (data.dryRun) {
    if (data.refreshed.length === 0 && data.unchanged.length === 0) {
      logger.info('[dry-run] No packs to refresh.');
      return;
    }
    logger.info(
      `[dry-run] Would refresh ${data.refreshed.length} pack(s); ${data.unchanged.length} unchanged.`,
    );
    for (const r of data.refreshed) {
      logger.info(`  - ${r.name}: ${r.oldSha ?? '—'} → ${r.newSha}`);
    }
    for (const u of data.unchanged) {
      logger.info(`  - ${u.name}: unchanged at ${u.ref}`);
    }
    return;
  }

  if (data.refreshed.length > 0) {
    logger.success(`Refreshed ${data.refreshed.length} pack(s):`);
    for (const r of data.refreshed) {
      logger.info(`  - ${r.name}: ${r.oldSha ?? '—'} → ${r.newSha}`);
    }
  }

  for (const u of data.unchanged) {
    logger.info(`Pack "${u.name}" unchanged at ${u.ref}.`);
  }

  for (const s of data.skipped) {
    logger.warn(`Skipped "${s.name}": ${s.reason}`);
  }

  for (const f of data.failed) {
    logger.error(`Failed "${f.name}" (${f.phase}): ${f.error}`);
  }
}
