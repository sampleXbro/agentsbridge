/**
 * Kilo Code-specific lint hooks.
 *
 * Kilo has no user-facing lifecycle hook system, so canonical hooks cannot be
 * projected. A warning surfaces the gap to users.
 *
 * Permissions are natively supported via `kilo.jsonc` (`permission` key) and
 * do not require a lint warning.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks) return [];
  const hasEntries = Object.values(canonical.hooks).some(
    (entries) => Array.isArray(entries) && entries.length > 0,
  );
  if (!hasEntries) return [];
  return [
    createWarning(
      '.agentsmesh/hooks.yaml',
      'kilo-code',
      'kilo-code does not support user-defined lifecycle hooks; canonical hooks are not projected.',
    ),
  ];
}
