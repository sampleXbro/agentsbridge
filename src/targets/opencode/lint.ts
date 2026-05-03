/**
 * OpenCode-specific lint hooks.
 *
 * OpenCode hooks are plugin-based (TypeScript/JavaScript lifecycle events),
 * not config-based. agentsmesh cannot generate plugin code from canonical hooks.
 *
 * Permissions and ignore live in `opencode.json` but are not generated in v1.
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
      'opencode',
      'opencode hooks are plugin-based (TypeScript/JavaScript); canonical config hooks are not projected.',
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
      'opencode',
      'opencode permissions live in opencode.json, which agentsmesh does not generate in v1; canonical permissions are not projected.',
    ),
  ];
}

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'opencode',
      'opencode has no dedicated ignore file; canonical ignore patterns are not projected. Configure watcher.ignore in opencode.json manually.',
    ),
  ];
}
