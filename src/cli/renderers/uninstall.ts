/**
 * Human-readable renderer for the `agentsmesh uninstall` command.
 *
 * Mirrors `renderInstall`: summary success line, per-skipped warning.
 * Forward-slash paths only.
 */

import { ui } from '../ui/ui.js';
import type { UninstallCommandResult } from '../commands/uninstall.js';

export function renderUninstall(result: UninstallCommandResult): void {
  const { data } = result;

  if (data.dryRun) {
    if (data.removed.length === 0) {
      ui.info('[dry-run] No installs matched.');
      return;
    }
    ui.info(`[dry-run] Would uninstall ${data.removed.length} pack(s):`);
    for (const r of data.removed) {
      const where = r.pack_path === null ? 'extends-only' : r.pack_path;
      ui.info(`  - ${r.name} (${where})`);
    }
    return;
  }

  if (data.removed.length > 0) {
    const names = data.removed.map((r) => `"${r.name}"`).join(', ');
    ui.success(`Uninstalled ${data.removed.length} pack(s): ${names}.`);
    ui.note(`Uninstalled ${data.removed.length} pack(s): ${names}.`, 'Uninstall');
  }

  for (const s of data.skipped) {
    ui.warn(`Skipped "${s.name}": ${s.reason}`);
  }

  for (const f of data.failed) {
    ui.error(`Failed "${f.name}": ${f.reason}`);
  }
}
