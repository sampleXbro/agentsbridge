/**
 * Junie-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { isUrlMcpServer } from '../../core/mcp-servers.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];

  const diagnostics: LintDiagnostic[] = [];
  for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
    if (isUrlMcpServer(server)) {
      diagnostics.push(
        createWarning(
          '.agentsmesh/mcp.json',
          'junie',
          `MCP server "${name}" uses ${server.type} transport; Junie project mcp.json currently documents stdio MCP servers only.`,
        ),
      );
    }
  }
  return diagnostics;
}
