/**
 * `.agents/mcp.json` serializer.
 *
 * `mcpConfigSchema` (CodebuffAI/freebuff `common/src/types/mcp.ts`) is a union
 * of two `z.strictObject`s and therefore REJECTS unknown keys:
 *
 *   remote: `{ type: 'http' | 'sse', url, params, headers }`
 *   stdio:  `{ type: 'stdio', command, args, env }`
 *
 * `loadMCPConfig` (`sdk/src/agents/load-mcp-config.ts`) validates the whole
 * document with `mcpFileSchema.safeParse` and `continue`s when it fails,
 * logging only under `verbose`. One unknown key on one server silently
 * discards EVERY server in the file, so writing canonical entries verbatim is
 * not an option: `description` (both shapes) and `env` (remote shape) must be
 * dropped, and the canonical free-form `type` must be narrowed to the literals
 * the schema accepts. `lintMcp` names everything dropped.
 */

import type { McpConfig, McpServer } from '../../core/types.js';
import { isUrlMcpServer } from '../../core/mcp-servers.js';

type Json = Record<string, unknown>;

/** Canonical transport names collapse onto the two literals freebuff accepts. */
function remoteType(server: McpServer): 'http' | 'sse' {
  return server.type === 'sse' ? 'sse' : 'http';
}

function serializeServer(server: McpServer): Json {
  if (isUrlMcpServer(server)) {
    return { type: remoteType(server), url: server.url, headers: server.headers };
  }
  return { type: 'stdio', command: server.command, args: server.args, env: server.env };
}

/** Canonical servers as a freebuff `.agents/mcp.json` document. */
export function serializeCodebuffMcp(mcp: McpConfig): string {
  const mcpServers: Json = {};
  for (const [name, server] of Object.entries(mcp.mcpServers)) {
    mcpServers[name] = serializeServer(server);
  }
  return JSON.stringify({ mcpServers }, null, 2);
}
