/**
 * Canonical MCP servers -> `.kimi-code/mcp.json`.
 *
 * `McpServerConfigSchema` (`agent-core-v2/src/mcpCore/config-schema.ts`) is a
 * discriminated union on `transport`, and its preprocess step only INFERS one
 * when the key is absent: `command` becomes `stdio`, `url` becomes `http`. The
 * canonical `type` is never read, so an `sse` server written verbatim would
 * connect over plain HTTP. Each entry therefore names its transport.
 *
 * The canonical keys stay alongside it: the schemas are plain `z.object`s, so
 * `type`, `description` and a remote `env` are stripped on load rather than
 * rejected — and keeping them is what lets the shared MCP importer rebuild the
 * canonical entry unchanged.
 *
 * `parseMcpJsonServers` calls `.parse`, not `safeParse`, so ONE rejected server
 * throws and Kimi Code refuses the whole file. Servers the schema would reject
 * are left out and named by `lintMcp` instead of taking every other server with
 * them.
 */

import type { McpServer } from '../../core/types.js';
import { isUrlMcpServer } from '../../core/mcp-servers.js';

/** Kimi Code's three transports; anything remote that is not SSE is HTTP. */
function transportOf(server: McpServer): 'stdio' | 'http' | 'sse' {
  if (!isUrlMcpServer(server)) return 'stdio';
  return server.type === 'sse' ? 'sse' : 'http';
}

/** `url: z.string().url()` and `command: z.string().min(1)` are the hard gates. */
export function isLoadableKimiMcpServer(server: McpServer): boolean {
  if (isUrlMcpServer(server)) return URL.canParse(server.url);
  return server.command.length > 0;
}

/** Remote servers have no `env` field, so canonical values there never apply. */
export function hasIgnoredRemoteEnv(server: McpServer): boolean {
  return isUrlMcpServer(server) && Object.keys(server.env).length > 0;
}

export function serializeKimiMcpServer(server: McpServer): Record<string, unknown> {
  return { transport: transportOf(server), ...server };
}
