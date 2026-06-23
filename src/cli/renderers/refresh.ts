/**
 * Human-readable renderer for `agentsmesh refresh`. Mirrors the
 * install/uninstall renderer style: per-line summary, forward-slash paths only.
 */

import { ui } from '../ui/ui.js';
import type { RefreshCommandResult } from '../../install/refresh/refresh-result.js';

export function renderRefresh(result: RefreshCommandResult): void {
  const { data } = result;

  if (data.dryRun) {
    if (data.refreshed.length === 0 && data.unchanged.length === 0) {
      ui.info('[dry-run] No packs to refresh.');
      return;
    }
    ui.info(
      `[dry-run] Would refresh ${data.refreshed.length} pack(s); ${data.unchanged.length} unchanged.`,
    );
    for (const r of data.refreshed) {
      ui.info(`  - ${r.name}: ${r.oldSha ?? '—'} → ${r.newSha}`);
    }
    for (const u of data.unchanged) {
      ui.info(`  - ${u.name}: unchanged at ${u.ref}`);
    }
    return;
  }

  if (data.refreshed.length > 0) {
    ui.success(`Refreshed ${data.refreshed.length} pack(s):`);
    ui.note(`Refreshed ${data.refreshed.length} pack(s).`, 'Refresh');
    for (const r of data.refreshed) {
      ui.info(`  - ${r.name}: ${r.oldSha ?? '—'} → ${r.newSha}`);
    }
  }

  for (const u of data.unchanged) {
    ui.info(`Pack "${u.name}" unchanged at ${u.ref}.`);
  }

  for (const s of data.skipped) {
    ui.warn(`Skipped "${s.name}": ${s.reason}`);
  }

  for (const f of data.failed) {
    ui.error(`Failed "${f.name}" (${f.phase}): ${f.error}`);
  }
}
