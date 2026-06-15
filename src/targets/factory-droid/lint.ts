/**
 * Factory Droid-specific lint warnings.
 *
 * Factory Droid has no native permissions (CLI-flag-only) or ignore
 * (relies on .gitignore) config files. Hooks are natively supported via
 * .factory/hooks.json. Commands are projected as skills via supportsConversion.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintPermissions(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.permissions) return [];
  const { allow, deny } = canonical.permissions;
  const ask = canonical.permissions.ask ?? [];
  if (allow.length === 0 && deny.length === 0 && ask.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/permissions.yaml',
      'factory-droid',
      'Factory Droid permissions are managed via CLI flags (--skip-permissions-unsafe); canonical permissions are not projected.',
    ),
  ];
}

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
