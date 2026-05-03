/**
 * Goose-specific lint hooks.
 *
 * Goose does not support commands, agents, hooks, MCP (project-level),
 * or permissions as standalone config files.
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
      'goose',
      'Goose has no lifecycle hook system; canonical hooks are not projected.',
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

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.commands.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/commands',
      'goose',
      'Goose slash commands are recipe-based in config.yaml; canonical commands are not projected.',
    ),
  ];
}

export function lintAgents(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.agents.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/agents',
      'goose',
      'Goose has no first-class agent config files; canonical agents are not projected.',
    ),
  ];
}
