/**
 * Factory Droid-specific lint hooks.
 *
 * Factory Droid does not support hooks (they live in settings.json via
 * PreToolUse/PostToolUse events), permissions (CLI-flag-only), or ignore
 * (relies on .gitignore) as standalone config files. Commands are projected
 * as skills via supportsConversion.
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
      'factory-droid',
      'Factory Droid hooks are configured via settings.json events (PreToolUse/PostToolUse), not standalone files; canonical hooks are not projected.',
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
