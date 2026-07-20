/**
 * Factory Droid-specific lint warnings.
 *
 * Factory Droid has no dedicated ignore file (relies on .gitignore). Hooks are
 * natively supported via .factory/hooks.json. Permissions are natively supported
 * via commandAllowlist/commandDenylist in .factory/settings.json.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'factory-droid',
      'Factory Droid has no dedicated ignore file and relies on .gitignore; canonical ignore patterns are not projected.',
    ),
  ];
}
