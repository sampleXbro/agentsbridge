/**
 * Cursor-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  return canonical.commands
    .filter((command) => command.description.length > 0 || command.allowedTools.length > 0)
    .map((command) =>
      createWarning(
        command.source,
        'cursor',
        'Cursor command files are plain Markdown; command description and allowed-tools metadata are not projected.',
      ),
    );
}

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];

  const diagnostics: LintDiagnostic[] = [];
  for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
    // Check for env vars or URL/header interpolation
    const hasEnv = server.env && Object.keys(server.env).length > 0;
    const hasUrl = 'url' in server;
    const hasHeaders = 'headers' in server;

    if (hasEnv || hasUrl || hasHeaders) {
      diagnostics.push(
        createWarning(
          '.agentsmesh/mcp.json',
          'cursor',
          `MCP server "${name}" uses env vars or URL/header interpolation; Cursor handling may differ from canonical MCP.`,
        ),
      );
    }
  }
  return diagnostics;
}

export function lintPermissions(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.permissions) return [];
  const askLen = canonical.permissions.ask?.length ?? 0;
  const hasEntries =
    canonical.permissions.allow.length > 0 || canonical.permissions.deny.length > 0 || askLen > 0;
  if (!hasEntries) return [];

  return [
    createWarning(
      '.agentsmesh/permissions.yaml',
      'cursor',
      'Cursor permissions are partial; tool-level allow/deny may lose fidelity.',
    ),
  ];
}
