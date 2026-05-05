/**
 * Human-readable renderer for lint command output.
 */

import { logger } from '../../utils/output/logger.js';
import type { LintCommandResult } from '../commands/lint.js';

export function renderLint(result: LintCommandResult): void {
  const { data } = result;

  if (data.diagnostics.length === 0) {
    logger.success('All checks passed.');
    return;
  }

  const errors = data.diagnostics.filter((d) => d.level === 'error');
  const warnings = data.diagnostics.filter((d) => d.level === 'warning');

  for (const d of errors) {
    logger.error(`${d.file} (${d.target}): ${d.message}`);
  }
  for (const d of warnings) {
    logger.warn(`${d.file} (${d.target}): ${d.message}`);
  }

  const errCount = data.summary.errors;
  const warnCount = data.summary.warnings;
  logger.info(
    `${errCount} error${errCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`,
  );
}
