/**
 * Rovo Dev-specific lint hooks.
 *
 * Rovo Dev does not support ignore as a standalone config file.
 * Hooks and permissions are emitted via emitScopedSettings (global only).
 * Commands and agents are projected as skills via supportsConversion.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'rovodev',
      'Rovo Dev has no dedicated ignore file and relies on .gitignore; canonical ignore patterns are not projected.',
    ),
  ];
}
