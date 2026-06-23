/**
 * Human-readable renderer for install command output.
 */

import { ui } from '../ui/ui.js';
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
    ui.success(`Installed ${summary}.`);
    ui.note(`Installed ${summary}.`, 'Install');
  }

  if (data.skipped.length > 0) {
    for (const s of data.skipped) {
      ui.warn(`Skipped ${s.kind} "${s.name}": ${s.reason}`);
    }
  }

  if (data.brokenResources && data.brokenResources.length > 0) {
    const count = data.brokenResources.length;
    ui.warn(
      `Skipped ${count} file${count > 1 ? 's' : ''} with invalid frontmatter; see --json for details.`,
    );
  }

  if (data.subPackFailures && data.subPackFailures.length > 0) {
    for (const f of data.subPackFailures) {
      ui.warn(`Sub-pack "${f.name}" (${f.path}) failed: ${f.error}`);
    }
  }
}
