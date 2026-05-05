/**
 * Human-readable renderer for import command output.
 */

import { logger } from '../../utils/output/logger.js';
import type { ImportCommandResult } from '../commands/import.js';

export function renderImport(result: ImportCommandResult): void {
  const { data } = result;

  if (data.files.length === 0) {
    logger.info(`Nothing to import from ${data.target}.`);
    return;
  }

  for (const f of data.files) {
    logger.success(`${f.from} → ${f.to}`);
  }
  const scopeFlag = data.scope === 'global' ? ' --global' : '';
  logger.info(
    `Imported ${data.files.length} file(s). Run 'agentsmesh generate${scopeFlag}' to sync to other tools.`,
  );
}
