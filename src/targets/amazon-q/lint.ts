/**
 * Amazon Q Developer-specific lint hooks.
 *
 * Amazon Q CLI hooks and permissions are per-agent only (embedded in agent JSON).
 * Canonical global hooks.yaml and permissions.yaml cannot be projected as
 * standalone config files, so these linters emit partial-support warnings.
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
      'amazon-q',
      'Amazon Q CLI hooks are per-agent only; canonical hooks are not projected as standalone config.',
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
      'amazon-q',
      'Amazon Q CLI permissions are per-agent (allowedTools); canonical permissions are not projected as standalone config.',
    ),
  ];
}
