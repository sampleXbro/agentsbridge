/**
 * Codex CLI-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];

  const diagnostics: LintDiagnostic[] = [];
  for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
    if (typeof server.description === 'string' && server.description) {
      diagnostics.push(
        createWarning(
          '.agentsmesh/mcp.json',
          'codex-cli',
          `MCP server "${name}" has a description, but codex-cli does not project MCP descriptions into .codex/config.toml.`,
        ),
      );
    }

    if ('url' in server || 'type' in server) {
      const type = 'type' in server ? server.type : 'url';
      diagnostics.push(
        createWarning(
          '.agentsmesh/mcp.json',
          'codex-cli',
          `MCP server "${name}" uses ${type} transport; codex-cli only generates stdio MCP servers.`,
        ),
      );
    }
  }
  return diagnostics;
}
