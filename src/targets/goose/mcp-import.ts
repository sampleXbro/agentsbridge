/**
 * Import Goose MCP extensions from `~/.config/goose/config.yaml`.
 *
 * Goose stores MCP servers as bespoke YAML `extensions` (see
 * `mcpServerToExtension` in `generator.ts`). This mapper reverses that
 * shape back into canonical `McpServer` entries and writes them to
 * `.agentsmesh/mcp.json` (global-only — Goose has no project MCP file).
 */

import { join, posix } from 'node:path';
import { parse as yamlParse } from 'yaml';
import type { McpServer } from '../../core/mcp-types.js';
import type {
  ImportEntryContext,
  ImportEntryMapping,
} from '../catalog/import-descriptor.js';
import { toStringArray, toStringRecord } from '../import/shared-import-helpers.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';

const GOOSE_CANONICAL_MCP = '.agentsmesh/mcp.json';

function extensionToMcpServer(raw: Record<string, unknown>): McpServer | null {
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
export async function gooseMcpMap(
  ctx: ImportEntryContext,
): Promise<ImportEntryMapping | null> {
  const imported = parseExtensions(ctx.content);
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
