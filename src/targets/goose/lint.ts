/**
 * Goose-specific lint warnings.
 *
 * Goose supports lifecycle hooks natively (Open Plugin Specification), so hooks
 * are generated, not warned about. Project-level MCP and permissions have no
 * standalone project config file. Commands and agents are projected as skills
 * via supportsConversion.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintPermissions(canonical: CanonicalFiles, options?: unknown): LintDiagnostic[] {
  // Permissions are native at global scope (~/.config/goose/permission.yaml);
  // only project scope (no permission file) warrants a warning.
  const scope = (options as { scope?: TargetLayoutScope } | undefined)?.scope;
  if (scope === 'global') return [];
  if (!canonical.permissions) return [];
  const { allow, deny } = canonical.permissions;
  const ask = canonical.permissions.ask ?? [];
  if (allow.length === 0 && deny.length === 0 && ask.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/permissions.yaml',
      'goose',
      'Goose applies tool permissions only at global scope (~/.config/goose/permission.yaml); project-scope permissions are not projected.',
    ),
  ];
}

export function lintMcp(canonical: CanonicalFiles, options?: unknown): LintDiagnostic[] {
  // MCP is native at global scope (~/.config/goose/config.yaml);
  // only project scope (no per-project config file) warrants a warning.
  const scope = (options as { scope?: TargetLayoutScope } | undefined)?.scope;
  if (scope === 'global') return [];
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/mcp.json',
      'goose',
      'Goose MCP extensions are configured globally in ~/.config/goose/config.yaml; project-level MCP is not projected.',
    ),
  ];
}
