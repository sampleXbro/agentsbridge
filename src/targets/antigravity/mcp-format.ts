/**
 * Antigravity `mcp_config.json` shape (antigravity.google/docs/mcp/).
 *
 * Local servers carry `command` / `args` / `env` / `cwd`; remote servers carry
 * `serverUrl` / `headers`. The docs state that "legacy fields like `url` or
 * `httpUrl` are not supported", which is also why this target cannot use the
 * shared `mcpJson` import mode: that helper only understands `url`, so every
 * remote Antigravity server would be silently dropped.
 *
 * The documented key set is exactly `command`, `args`, `env`, `cwd`,
 * `serverUrl`, `headers`, `authProviderType`, `oauth`, `disabled` and
 * `disabledTools`. Canonical `type` and `description` are NOT in it, so they are
 * never written here; `mcp-import.ts` carries them over from the canonical
 * entry instead, which keeps generate -> import a fixed point.
 */

import type { McpConfig, McpServer } from '../../core/types.js';
import { toStringArray, toStringRecord } from '../import/shared-import-helpers.js';

type Json = Record<string, unknown>;

/** Server keys agentsmesh rewrites from canonical on every generate. */
export const ANTIGRAVITY_OWNED_SERVER_KEYS: readonly string[] = [
  'command',
  'args',
  'env',
  'serverUrl',
  'headers',
];

function omitEmpty(entries: Json): Json {
  for (const key of Object.keys(entries)) {
    const value = entries[key];
    if (value === undefined) delete entries[key];
    else if (Array.isArray(value) && value.length === 0) delete entries[key];
    else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    ) {
      delete entries[key];
    }
  }
  return entries;
}

function serializeServer(server: McpServer): Json {
  if ('url' in server) {
    return omitEmpty({ serverUrl: server.url, headers: server.headers, env: server.env });
  }
  return omitEmpty({ command: server.command, args: server.args, env: server.env });
}

/** Canonical servers as an Antigravity `mcp_config.json` document. */
export function serializeAntigravityMcp(mcp: McpConfig): string {
  const mcpServers: Json = {};
  for (const [name, server] of Object.entries(mcp.mcpServers)) {
    mcpServers[name] = serializeServer(server);
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

function parseServer(raw: unknown): McpServer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const server = raw as Json;
  const env = toStringRecord(server.env);
  // `description` is not an Antigravity key, but a hand-written one is worth
  // keeping; `mcp-import.ts` still lets the canonical value win.
  const described =
    typeof server.description === 'string' ? { description: server.description } : {};
  const url = typeof server.serverUrl === 'string' ? server.serverUrl : server.url;
  if (typeof url === 'string') {
    return {
      ...described,
      type: typeof server.type === 'string' ? server.type : 'http',
      url,
      headers: toStringRecord(server.headers),
      env,
    };
  }
  if (typeof server.command !== 'string') return null;
  return {
    ...described,
    type: typeof server.type === 'string' ? server.type : 'stdio',
    command: server.command,
    args: toStringArray(server.args),
    env,
  };
}

/** Servers found in an Antigravity `mcp_config.json` document. */
export function parseAntigravityMcpServers(content: string): Record<string, McpServer> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const raw = (parsed as Json).mcpServers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(raw)) {
    const server = parseServer(value);
    if (server) out[name] = server;
  }
  return out;
}
