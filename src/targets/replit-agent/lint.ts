/**
 * Replit Agent-specific lint hooks.
 *
 * Replit Agent does not support hooks, permissions, ignore, or MCP
 * as standalone config files. Commands and agents are projected as
 * skills via supportsConversion.
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
      'replit-agent',
      'Replit Agent has no lifecycle hook system; canonical hooks are not projected.',
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
      'replit-agent',
      'Replit Agent permissions are managed in the cloud UI; canonical permissions are not projected.',
    ),
  ];
}

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'replit-agent',
      'Replit Agent has no dedicated ignore file and relies on .gitignore; canonical ignore patterns are not projected.',
    ),
  ];
}

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/mcp.json',
      'replit-agent',
      'Replit Agent MCP servers are configured via the Integrations UI, not file-based; canonical MCP config is not projected.',
    ),
  ];
}
