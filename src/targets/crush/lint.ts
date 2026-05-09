/**
 * Crush-specific lint hooks.
 *
 * Crush does not support dedicated commands as slash-commands;
 * use supportsConversion to project commands/agents as skills instead.
 * Permissions in crush.json use allowed_tools/denied_tools — canonical
 * permissions map to partial support.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.commands.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/commands',
      'crush',
      'Crush has no native slash-command format; commands are projected as skills via supportsConversion.',
    ),
  ];
}
