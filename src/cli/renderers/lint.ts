/**
 * Human-readable renderer for lint command output.
 */

import { ui } from '../ui/ui.js';
import type { LintCommandResult } from '../commands/lint.js';

export function renderLint(result: LintCommandResult): void {
  const { data } = result;

  if (data.diagnostics.length === 0) {
    ui.success('All checks passed.');
    return;
  }

  const errors = data.diagnostics.filter((d) => d.level === 'error');
  const warnings = data.diagnostics.filter((d) => d.level === 'warning');

  for (const d of errors) {
    ui.error(`${d.file} (${d.target}): ${d.message}`);
  }
  for (const d of warnings) {
    ui.warn(`${d.file} (${d.target}): ${d.message}`);
  }

  const errCount = data.summary.errors;
  const warnCount = data.summary.warnings;
  ui.info(
    `${errCount} error${errCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`,
  );
}
