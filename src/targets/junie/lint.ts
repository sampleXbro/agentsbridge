/**
 * Junie-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];

  const diagnostics: LintDiagnostic[] = [];
  for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
    if ('url' in server || 'type' in server) {
      const type = 'type' in server ? server.type : 'url';
      diagnostics.push(
        createWarning(
          '.agentsmesh/mcp.json',
          'junie',
          `MCP server "${name}" uses ${type} transport; Junie project mcp.json currently documents stdio MCP servers only.`,
        ),
      );
    }
  }
  return diagnostics;
}
