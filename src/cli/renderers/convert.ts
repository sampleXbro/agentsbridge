import { logger } from '../../utils/output/logger.js';
import type { ConvertData } from '../command-result.js';

interface ConvertCommandResult {
  exitCode: number;
  data: ConvertData;
}

export function renderConvert(result: ConvertCommandResult): void {
  const { data } = result;

  if (data.files.length === 0) {
    logger.info(`No files found to convert from ${data.from}.`);
    return;
  }

  if (data.mode === 'dry-run') {
    for (const f of data.files) {
      logger.info(`[dry-run] ${f.status} ${f.path} (${f.target})`);
    }
    return;
  }

  for (const f of data.files) {
    if (f.status === 'created' || f.status === 'updated') {
      logger.success(`${f.status} ${f.path}`);
    }
  }

  const { created, updated, unchanged } = data.summary;
  if (created > 0 || updated > 0) {
    logger.info(
      `Converted from ${data.from} → ${data.to}: ${created} created, ${updated} updated, ${unchanged} unchanged`,
    );
  } else {
    logger.info(`Nothing changed. (${unchanged} unchanged)`);
  }
}
