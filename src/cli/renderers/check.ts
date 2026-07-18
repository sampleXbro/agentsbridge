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
    ui.note('Lock file is in sync; generated outputs are in sync.', 'Check');
    ui.success('Lock file is in sync; generated outputs are in sync.');
    return;
  }

  if (data.canonicalDrift) renderCanonicalDrift(data);
  if (data.outputDrift) renderOutputDrift(data);
}

function renderCanonicalDrift(data: CheckCommandResult['data']): void {
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
  ui.info(
    "Run 'agentsmesh merge' to resolve, or 'agentsmesh generate --force' to accept current state.",
  );
}

function renderOutputDrift(data: CheckCommandResult['data']): void {
  ui.error('Generated output drift detected:');
  for (const path of data.outputModified) {
    ui.error(`  ${path} was modified`);
  }
  for (const path of data.outputRemoved) {
    ui.error(`  ${path} is missing`);
  }
  for (const path of data.outputStale) {
    ui.error(`  ${path} is stale (no longer generated)`);
  }
  ui.note('Generated files are out of sync.', 'Check');
  ui.info("Run 'agentsmesh generate' and commit the updated outputs.");
}
