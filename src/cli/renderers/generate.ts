/**
 * Human-readable renderer for generate command output.
 */

import { logger } from '../../utils/output/logger.js';
import type { GenerateCommandResult } from '../commands/generate.js';

/**
 * Format a generated-output path for user-facing log lines.
 * In global mode the path is resolved against the user home directory, not the
 * project root — prefix with `~/` so users don't misread a log line like
 * `✓ updated .claude/settings.json` as a project-local write.
 */
function formatDisplayPath(scope: 'project' | 'global', relPath: string): string {
  return scope === 'global' ? `~/${relPath}` : relPath;
}

export function renderGenerate(result: GenerateCommandResult): void {
  const { data } = result;
  const { scope, mode, files } = data;

  if (files.length === 0) {
    logger.info('No files to generate (no root rule or rules feature disabled).');
    if (mode === 'check') {
      logger.success('Generated files are in sync.');
    }
    return;
  }

  if (mode === 'check') {
    const drifted = files.filter((f) => f.status !== 'unchanged');
    if (drifted.length === 0) {
      logger.success('Generated files are in sync.');
      return;
    }
    for (const f of drifted) {
      logger.error(`[check] ${f.status} ${formatDisplayPath(scope, f.path)} (${f.target})`);
    }
    logger.error("Generated files are out of sync. Run 'agentsmesh generate' to update them.");
    return;
  }

  if (mode === 'dry-run') {
    for (const f of files) {
      logger.info(`[dry-run] ${f.status} ${formatDisplayPath(scope, f.path)} (${f.target})`);
    }
    return;
  }

  // Normal generate mode
  for (const f of files) {
    if (f.status === 'created' || f.status === 'updated') {
      logger.success(`${f.status} ${formatDisplayPath(scope, f.path)}`);
    }
  }

  const { created, updated, unchanged } = data.summary;
  if (created > 0 || updated > 0) {
    logger.info(`Generated: ${created} created, ${updated} updated, ${unchanged} unchanged`);
  } else {
    logger.info(`Nothing changed. (${unchanged} unchanged)`);
  }
}
