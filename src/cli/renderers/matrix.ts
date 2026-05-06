/**
 * Human-readable renderer for matrix command output.
 */

import { logger } from '../../utils/output/logger.js';
import { formatMatrix } from '../../core/matrix/matrix.js';
import type { MatrixCommandResult } from '../commands/matrix.js';
import type { CompatibilityRow, SupportLevel } from '../../core/types.js';

export interface MatrixRenderOptions {
  verbose?: boolean;
}

export function renderMatrix(result: MatrixCommandResult, options?: MatrixRenderOptions): void {
  if (result.data.features.length === 0) {
    logger.info('No features enabled. Enable features in agentsmesh.yaml.');
    return;
  }

  const rows: CompatibilityRow[] = result.data.features.map((f) => ({
    feature: f.name,
    count: 0,
    support: f.support as Record<string, SupportLevel>,
  }));

  const table = formatMatrix(rows, result.data.targets);
  process.stdout.write(table);
  process.stdout.write('\n');

  if (options?.verbose && result.verboseDetails) {
    process.stdout.write(result.verboseDetails);
    process.stdout.write('\n');
  }
}
