/**
 * Goose-specific lint warnings.
 *
 * Goose supports lifecycle hooks natively (Open Plugin Specification), so hooks
 * are generated, not warned about. Project-level MCP and permissions have no
 * standalone project config file. Commands and agents are projected as skills
 * via supportsConversion.
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
      'goose',
      'Goose permissions are managed at runtime via permission.yaml in ~/.config/goose/; canonical permissions are not projected.',
    ),
  ];
}

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/mcp.json',
      'goose',
      'Goose MCP extensions are configured globally in ~/.config/goose/config.yaml; project-level MCP is not projected.',
    ),
  ];
}
