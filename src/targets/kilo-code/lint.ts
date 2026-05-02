/**
 * Kilo Code-specific lint hooks.
 *
 * Kilo has no user-facing lifecycle hook system, and agentsmesh does not
 * generate `kilo.jsonc` in v1 (so canonical permissions cannot be projected).
 * Both warnings exist to surface the gap so users know their canonical
 * settings won't reach kilo.
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

export function lintPermissions(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.permissions) return [];
  const { allow, deny } = canonical.permissions;
  const ask = canonical.permissions.ask ?? [];
  if (allow.length === 0 && deny.length === 0 && ask.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/permissions.yaml',
      'kilo-code',
      'kilo-code permissions live in kilo.jsonc, which agentsmesh does not generate in v1; canonical permissions are not projected.',
    ),
  ];
}
