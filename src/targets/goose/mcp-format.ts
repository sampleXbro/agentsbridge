/**
 * Goose project plugin `.mcp.json` shape.
 *
 * `crates/goose/src/plugins/mcp_servers.rs`:
 *   `McpServersDocument { #[serde(default, rename = "mcpServers")] .. }`
 *   `McpServerConfig { command: String, #[serde(default)] args, env, cwd }`
 * There is no `deny_unknown_fields`, so goose ignores extra keys, and `command`
 * has no serde default, so ONE entry without it fails the whole document — which
 * is why remote servers are omitted rather than written and ignored.
 */

import type { McpConfig, McpServer } from '../../core/mcp-types.js';

/** Server keys agentsmesh rewrites from canonical on every generate. */
export const GOOSE_OWNED_MCP_SERVER_KEYS: readonly string[] = [
  'type',
  'command',
  'args',
  'env',
  'description',
  'url',
  'headers',
];

/** Canonical stdio servers as a goose plugin `.mcp.json` document. */
export function serializeGooseProjectMcp(mcp: McpConfig): string {
  const mcpServers: Record<string, McpServer> = {};
  for (const [name, server] of Object.entries(mcp.mcpServers)) {
    if ('command' in server) mcpServers[name] = server;
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

/** True when canonical holds at least one server goose's plugin parser accepts. */
export function hasGooseProjectMcpServers(mcp: McpConfig | null): boolean {
  if (!mcp) return false;
  return Object.values(mcp.mcpServers).some((server) => 'command' in server);
}
