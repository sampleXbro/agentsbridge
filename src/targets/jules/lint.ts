/**
 * Jules-specific lint hooks.
 *
 * Jules is a cloud-based async coding agent that only reads `AGENTS.md`.
 * It does not support hooks, permissions, ignore, MCP, commands, or
 * skills as standalone config files.
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
      'jules',
      'Jules has no lifecycle hook system; canonical hooks are not projected.',
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
      'jules',
      'Jules has no permissions system; canonical permissions are not projected.',
    ),
  ];
}

export function lintIgnore(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.ignore.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/ignore',
      'jules',
      'Jules is a cloud-based agent with no dedicated ignore file; canonical ignore patterns are not projected.',
    ),
  ];
}

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/mcp.json',
      'jules',
      'Jules is a cloud-based agent with no MCP support; canonical MCP servers are not projected.',
    ),
  ];
}

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.commands.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/commands',
      'jules',
      'Jules has no command system; canonical commands are not projected.',
    ),
  ];
}

export function lintSkills(canonical: CanonicalFiles): LintDiagnostic[] {
  if (canonical.skills.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/skills',
      'jules',
      'Jules is a cloud-based agent with no skills directory; canonical skills are not projected.',
    ),
  ];
}
