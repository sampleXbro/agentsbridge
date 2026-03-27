import type { CanonicalFiles, LintDiagnostic } from '../types.js';
import { isUrlMcpServer, usesCursorSensitiveInterpolation } from '../mcp-servers.js';

export function lintMcp(canonical: CanonicalFiles, target: string): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];

  const diagnostics: LintDiagnostic[] = [];
  for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
    if (target === 'cursor' && usesCursorSensitiveInterpolation(server)) {
      diagnostics.push({
        level: 'warning',
        file: '.agentsmesh/mcp.json',
        target,
        message: `MCP server "${name}" uses env vars or URL/header interpolation; Cursor handling may differ from canonical MCP.`,
      });
    }

    if (target === 'codex-cli' && typeof server.description === 'string' && server.description) {
      diagnostics.push({
        level: 'warning',
        file: '.agentsmesh/mcp.json',
        target,
        message: `MCP server "${name}" has a description, but codex-cli does not project MCP descriptions into .codex/config.toml.`,
      });
    }

    if (target === 'codex-cli' && isUrlMcpServer(server)) {
      diagnostics.push({
        level: 'warning',
        file: '.agentsmesh/mcp.json',
        target,
        message: `MCP server "${name}" uses ${server.type} transport; codex-cli only generates stdio MCP servers.`,
      });
    }

    if (target === 'junie' && isUrlMcpServer(server)) {
      diagnostics.push({
        level: 'warning',
        file: '.agentsmesh/mcp.json',
        target,
        message: `MCP server "${name}" uses ${server.type} transport; Junie project mcp.json currently documents stdio MCP servers only.`,
      });
    }
  }

  if (target === 'windsurf') {
    diagnostics.push({
      level: 'warning',
      file: '.agentsmesh/mcp.json',
      target,
      message:
        'Windsurf MCP is partial; generated .windsurf/mcp_config.example.json is a reference artifact and may require manual setup.',
    });
  }
  return diagnostics;
}
