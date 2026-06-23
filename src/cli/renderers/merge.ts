/**
 * Human-readable renderer for merge command output.
 */

import { ui } from '../ui/ui.js';
import type { MergeCommandResult } from '../commands/merge.js';

export function renderMerge(result: MergeCommandResult): void {
  if (!result.data.hadConflict) {
    ui.info('No conflicts to resolve.');
    return;
  }
  ui.success('Lock file conflict resolved.');
}
