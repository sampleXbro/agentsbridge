/**
 * Human-readable renderer for install command output.
 */

import { logger } from '../../utils/output/logger.js';
import type { InstallCommandResult } from '../commands/install.js';

export function renderInstall(result: InstallCommandResult): void {
  const { data } = result;

  if (data.mode === 'sync' && data.installed.length === 0 && data.skipped.length === 0) {
    return;
  }

  if (data.installed.length > 0 && !data.dryRun) {
    const kinds = new Set(data.installed.map((i) => i.kind));
    const summary = [...kinds]
      .map((k) => {
        const count = data.installed.filter((i) => i.kind === k).length;
        return `${count} ${k}${count > 1 ? 's' : ''}`;
      })
      .join(', ');
    logger.success(`Installed ${summary}.`);
  }

  if (data.skipped.length > 0) {
    for (const s of data.skipped) {
      logger.warn(`Skipped ${s.kind} "${s.name}": ${s.reason}`);
    }
  }
}
