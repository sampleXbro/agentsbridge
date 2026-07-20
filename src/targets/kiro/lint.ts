/**
 * Kiro-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import {
  createUnsupportedHookWarning,
  createWarning,
  unsupportedHookEventNames,
} from '../../core/lint/shared/helpers.js';

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const supported = ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'SubagentStop'] as const;
  return unsupportedHookEventNames(canonical.hooks, supported).map((event) =>
    createUnsupportedHookWarning(event, 'kiro', supported, { unsupportedBy: 'Kiro hooks' }),
  );
}

export function lintPermissions(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.permissions) return [];
  const { allow, deny } = canonical.permissions;
  const ask = canonical.permissions.ask ?? [];
  if (allow.length === 0 && deny.length === 0 && ask.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/permissions.yaml',
      'kiro',
      'Kiro v3 permissions are supported in permissions.yaml (workspace/global); agentsmesh does not generate permissions files yet. Configure permissions manually.',
    ),
  ];
}
