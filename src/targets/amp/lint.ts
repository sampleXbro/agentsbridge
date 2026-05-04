/**
 * Amp-specific lint hooks.
 *
 * Amp does not support hooks, permissions, or ignore as standalone
 * config files. Commands and agents are projected as skills via
 * supportsConversion.
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
      'amp',
      'Amp has no lifecycle hook system; canonical hooks are not projected.',
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
      'amp',
      'Amp permissions are managed via amp.permissions in settings.json; canonical permissions are not projected.',
    ),
  ];
}

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'amp',
      'Amp has no dedicated ignore file and relies on .gitignore; canonical ignore patterns are not projected.',
    ),
  ];
}
