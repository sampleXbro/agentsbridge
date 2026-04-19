/**
 * Cline-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  return canonical.commands
    .filter((command) => command.description.length > 0 || command.allowedTools.length > 0)
    .map((command) =>
      createWarning(
        command.source,
        'cline',
        'cline workflow files are plain Markdown; command description and allowed-tools metadata are not projected.',
      ),
    );
}
