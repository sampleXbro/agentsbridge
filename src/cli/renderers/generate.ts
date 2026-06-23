/**
 * Human-readable renderer for generate command output.
 */

import { ui } from '../ui/ui.js';
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
    if (data.emptyReason === 'no-global-support') {
      ui.info('No files to generate (target has no global mode — try without --global).');
    } else {
      ui.info('No files to generate (no root rule or rules feature disabled).');
    }
    if (mode === 'check') {
      ui.success('Generated files are in sync.');
    }
    return;
  }

  if (mode === 'check') {
    const drifted = files.filter((f) => f.status !== 'unchanged');
    if (drifted.length === 0) {
      ui.success('Generated files are in sync.');
      return;
    }
    for (const f of drifted) {
      ui.error(`[check] ${f.status} ${formatDisplayPath(scope, f.path)} (${f.target})`);
    }
    ui.error("Generated files are out of sync. Run 'agentsmesh generate' to update them.");
    return;
  }

  if (mode === 'dry-run') {
    for (const f of files) {
      ui.info(`[dry-run] ${f.status} ${formatDisplayPath(scope, f.path)} (${f.target})`);
    }
    return;
  }

  // Normal generate mode
  for (const f of files) {
    if (f.status === 'created' || f.status === 'updated') {
      ui.success(`${f.status} ${formatDisplayPath(scope, f.path)}`);
    }
  }

  const { created, updated, unchanged } = data.summary;
  if (created > 0 || updated > 0) {
    ui.note(`${created} created · ${updated} updated · ${unchanged} unchanged`, 'Generated');
    ui.info(`Generated: ${created} created, ${updated} updated, ${unchanged} unchanged`);
  } else {
    ui.info(`Nothing changed. (${unchanged} unchanged)`);
  }
}
