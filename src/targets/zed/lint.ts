/**
 * Zed-specific lint hooks.
 *
 * Zed does not support hooks, permissions, or ignore as standalone
 * config files. It has no native commands, agents, or skills surface.
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
      'zed',
      'Zed permissions are supported via agent.tool_permissions in .zed/settings.json; agentsmesh does not generate permissions config yet. Configure tool_permissions manually.',
    ),
  ];
}

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'zed',
      'Zed ignore is supported via file_scan_exclusions in .zed/settings.json; agentsmesh does not generate ignore config yet. Configure file_scan_exclusions manually.',
    ),
  ];
}
