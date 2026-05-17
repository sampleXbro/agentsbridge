/**
 * Human-readable renderer for the `agentsmesh uninstall` command.
 *
 * Mirrors `renderInstall`: summary success line, per-skipped warning.
 * Forward-slash paths only.
 */

import { logger } from '../../utils/output/logger.js';
import type { UninstallCommandResult } from '../commands/uninstall.js';

export function renderUninstall(result: UninstallCommandResult): void {
  const { data } = result;

  if (data.dryRun) {
    if (data.removed.length === 0) {
      logger.info('[dry-run] No installs matched.');
      return;
    }
    logger.info(`[dry-run] Would uninstall ${data.removed.length} pack(s):`);
    for (const r of data.removed) logger.info(`  - ${r.name} (${r.pack_path})`);
    return;
  }

  if (data.removed.length > 0) {
    const names = data.removed.map((r) => `"${r.name}"`).join(', ');
    logger.success(`Uninstalled ${data.removed.length} pack(s): ${names}.`);
  }

  for (const s of data.skipped) {
    logger.warn(`Skipped "${s.name}": ${s.reason}`);
  }
}
