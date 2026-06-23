/**
 * Human-readable renderer for check command output.
 */

import { ui } from '../ui/ui.js';
import type { CheckCommandResult } from '../commands/check.js';

export function renderCheck(result: CheckCommandResult): void {
  const { data } = result;

  if (!data.hasLock) {
    ui.error("Not initialized for collaboration. Run 'agentsmesh generate' first.");
    return;
  }

  if (data.inSync) {
    ui.note('Lock file is in sync.', 'Check');
    ui.success('Lock file is in sync.');
    return;
  }

  const lockedSet = new Set(data.lockedViolations);
  ui.error('Conflict detected:');
  for (const p of data.extendsModified) {
    ui.error(`  extend "${p}" was modified`);
  }
  for (const p of data.modified) {
    const suffix = lockedSet.has(p) ? ' [LOCKED]' : '';
    ui.error(`  ${p} was modified${suffix}`);
  }
  for (const p of data.added) {
    const suffix = lockedSet.has(p) ? ' [LOCKED]' : '';
    ui.error(`  ${p} was added${suffix}`);
  }
  for (const p of data.removed) {
    const suffix = lockedSet.has(p) ? ' [LOCKED]' : '';
    ui.error(`  ${p} was removed${suffix}`);
  }
  ui.note('Generated files are out of sync.', 'Check');
  ui.info(
    "Run 'agentsmesh merge' to resolve, or 'agentsmesh generate --force' to accept current state.",
  );
}
