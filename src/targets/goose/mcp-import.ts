/**
 * Import Goose MCP servers from either scope's file.
 *
 * Globally, Goose stores them as bespoke YAML `extensions` (see
 * `mcpServerToExtension` in `generator.ts`); at project scope, as a standard
 * `mcpServers` map inside the `agentsmesh` plugin's `.mcp.json`. Both reverse
 * into canonical `McpServer` entries written to `.agentsmesh/mcp.json`.
 */

import { join, posix } from 'node:path';
import { parse as yamlParse } from 'yaml';
import type { McpServer } from '../../core/mcp-types.js';
import type { ImportEntryContext, ImportEntryMapping } from '../catalog/import-descriptor.js';
import { toStringArray, toStringRecord } from '../import/shared-import-helpers.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';

const GOOSE_CANONICAL_MCP = '.agentsmesh/mcp.json';

/**
 * One `extensions` entry as a canonical server, or `null` when it has no
 * canonical representation (goose builtins carry neither `cmd` nor `uri`).
 * `global-mcp.ts` uses the same predicate to decide which entries generate owns.
 */
export function extensionToMcpServer(raw: Record<string, unknown>): McpServer | null {
  const description = typeof raw.description === 'string' ? raw.description : '';
  const env = toStringRecord(raw.envs);
  const isStdio = raw.type === 'stdio' || typeof raw.cmd === 'string';
  if (isStdio) {
    if (typeof raw.cmd !== 'string') return null;
    return {
      type: 'stdio',
      command: raw.cmd,
      args: toStringArray(raw.args),
      env,
      ...(description !== '' && { description }),
    };
  }
  if (typeof raw.uri !== 'string') return null;
  return {
    type: 'sse',
    url: raw.uri,
    headers: {},
    env,
    ...(description !== '' && { description }),
  };
}

/**
 * One plugin `.mcp.json` entry as a canonical server.
 *
 * Goose itself only runs stdio entries, but a user who drops a `.mcp.json` from
 * another tool into the plugin dir must not lose its remote entries: canonical
 * can hold them, so they are imported and `lintMcp` is what names them as
 * unusable by goose. Entries with neither `command` nor `url` have no canonical
 * shape at all and are skipped.
 *
 * KNOWN GAP: goose's `cwd` is not copied here because `StdioMcpServer` has no
 * such field and `parseMcp` would drop it again on the next load. It is not
 * destroyed, though — `mergeGooseMcpContent` carries it over on every generate,
 * so the file goose actually reads keeps it. Closing the gap end-to-end needs
 * `cwd?: string` on `StdioMcpServer`, in `parseMcp`, and in the canonical schema.
 */
function pluginEntryToMcpServer(raw: Record<string, unknown>): McpServer | null {
  const description = typeof raw.description === 'string' ? raw.description : undefined;
  const described = description !== undefined ? { description } : {};
  if (typeof raw.command === 'string') {
    return {
      type: typeof raw.type === 'string' ? raw.type : 'stdio',
      command: raw.command,
      args: toStringArray(raw.args),
      env: toStringRecord(raw.env),
      ...described,
    };
  }
  if (typeof raw.url !== 'string') return null;
  return {
    type: typeof raw.type === 'string' ? raw.type : 'http',
    url: raw.url,
    headers: toStringRecord(raw.headers),
    env: toStringRecord(raw.env),
    ...described,
  };
}

/** Project scope: the plugin `.mcp.json`, already in canonical shape. */
function parsePluginMcpJson(content: string): Record<string, McpServer> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const servers = (parsed as Record<string, unknown>).mcpServers;
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return {};
  const out: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(servers as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const server = pluginEntryToMcpServer(value as Record<string, unknown>);
    if (server) out[name] = server;
  }
  return out;
}

function parseExtensions(content: string): Record<string, McpServer> {
  let parsed: unknown;
  try {
    parsed = yamlParse(content);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const extensions = (parsed as Record<string, unknown>).extensions;
  if (!extensions || typeof extensions !== 'object' || Array.isArray(extensions)) return {};
  const out: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(extensions as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const server = extensionToMcpServer(value as Record<string, unknown>);
    if (server) out[name] = server;
  }
  return out;
}

async function readExistingServers(destPath: string): Promise<Record<string, McpServer>> {
  const content = await readFileSafe(destPath);
  if (content === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const raw = (parsed as Record<string, unknown>).mcpServers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    out[name] = value as McpServer;
  }
  return out;
}

/**
 * Descriptor `map` for the Goose MCP importer (`singleFile` mode). Reverses the
 * bespoke `extensions` YAML into canonical servers, merges with any existing
 * `.agentsmesh/mcp.json` (imported set wins on name collision), and returns the
 * merged JSON so the runner performs the single atomic write.
 */
export async function gooseMcpMap(ctx: ImportEntryContext): Promise<ImportEntryMapping | null> {
  const imported = ctx.relativePath.endsWith('.mcp.json')
    ? parsePluginMcpJson(ctx.content)
    : parseExtensions(ctx.content);
  if (Object.keys(imported).length === 0) return null;

  const destPath = join(ctx.destDir, 'mcp.json');
  const existing = await readExistingServers(destPath);
  const merged: Record<string, McpServer> = { ...existing, ...imported };
  return {
    destPath,
    toPath: posix.normalize(GOOSE_CANONICAL_MCP),
    content: JSON.stringify({ mcpServers: merged }, null, 2),
  };
}
