/**
 * Deep Agents CLI-specific lint functions.
 *
 * Deep Agents CLI does not support permissions or ignore as
 * standalone project config files. Commands and agents are projected
 * as skills via supportsConversion. Hooks are natively supported
 * via `.deepagents/hooks.json`.
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
      'deepagents-cli',
      'Deep Agents CLI permissions are managed via shell allow-lists (--shell-allow-list); canonical permissions are not projected.',
    ),
  ];
}

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'deepagents-cli',
      'Deep Agents CLI has no dedicated ignore file and relies on .gitignore; canonical ignore patterns are not projected.',
    ),
  ];
}
