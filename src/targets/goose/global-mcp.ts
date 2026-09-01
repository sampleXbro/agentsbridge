/**
 * Global MCP for Goose: the `extensions` block of `~/.config/goose/config.yaml`.
 *
 * That file is goose's PRIMARY config — `goose configure` writes `GOOSE_PROVIDER`,
 * `GOOSE_MODEL`, `GOOSE_MODE`, CLI theme keys and the builtin extension entries
 * into it, and the docs tell users to hand-edit it. So this runs from
 * `scopeExtras` (which can read the disk) rather than the plain feature loop, and:
 *   - agentsmesh rewrites the `extensions` key and nothing else, through a YAML
 *     Document so the user's comments and formatting survive;
 *   - inside `extensions` it owns exactly the entries the goose importer can turn
 *     back into canonical servers. A builtin entry (`type: builtin`, no `cmd`/`uri`)
 *     has no canonical representation, so deleting it would be a one-way loss —
 *     it is kept;
 *   - `canonical.mcp === null` means no `.agentsmesh/mcp.json` at all: no opinion,
 *     so the block is left alone. An empty one is an opinion, and revokes.
 *
 * `config.yaml` is deliberately NOT in `managedOutputs.files`: stale-cleanup
 * deletes every managed file a run did not emit, so listing it would let a global
 * run without the `mcp` feature erase the user's whole goose config.
 */

import { join } from 'node:path';
import { isMap, parseDocument, stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles, GenerateResult } from '../../core/types.js';
import type { McpServer } from '../../core/mcp-types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { computeStatus } from '../../core/generate/feature-loop.js';
import { extensionToMcpServer } from './mcp-import.js';
import { GOOSE_TARGET, GOOSE_GLOBAL_CONFIG } from './constants.js';

type Json = Record<string, unknown>;

interface GooseExtension {
  args?: string[];
  bundled: null;
  cmd?: string;
  description: string;
  enabled: boolean;
  env_keys: string[];
  envs: Record<string, string>;
  name: string;
  timeout: number;
  type: string;
  uri?: string;
}

export function mcpServerToExtension(name: string, server: McpServer): GooseExtension {
  const base: GooseExtension = {
    bundled: null,
    description: server.description ?? '',
    enabled: true,
    env_keys: [],
    envs: server.env,
    name,
    timeout: 30,
    type: 'command' in server ? 'stdio' : 'sse',
  };
  if ('command' in server) {
    return { ...base, args: server.args, cmd: server.command };
  }
  return { ...base, uri: server.url };
}

function asObject(value: unknown): Json | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Json;
}

/** Entries the importer cannot represent (goose builtins) survive generate. */
function unownedExtensions(existing: unknown): Json {
  const block = asObject(existing);
  if (!block) return {};
  const out: Json = {};
  for (const [name, value] of Object.entries(block)) {
    const entry = asObject(value);
    if (entry && extensionToMcpServer(entry) === null) out[name] = entry;
  }
  return out;
}

function buildExtensions(servers: Record<string, McpServer>): Json {
  const out: Json = {};
  for (const [name, server] of Object.entries(servers)) {
    out[name] = mcpServerToExtension(name, server);
  }
  return out;
}

function result(content: string, existing: string | null): GenerateResult {
  return {
    target: GOOSE_TARGET,
    path: GOOSE_GLOBAL_CONFIG,
    content,
    ...(existing !== null && { currentContent: existing }),
    status: computeStatus(existing, content),
  };
}

/**
 * `~/.config/goose/config.yaml` with only its `extensions` key rewritten.
 * Returns `[]` when there is nothing to change, when canonical has no opinion,
 * or when the file is not a YAML mapping (rewriting it would destroy the config).
 */
export async function generateGooseGlobalMcp(
  canonical: CanonicalFiles,
  projectRoot: string,
  enabledFeatures: ReadonlySet<string>,
): Promise<GenerateResult[]> {
  if (!enabledFeatures.has('mcp') || canonical.mcp === null) return [];
  const existing = await readFileSafe(join(projectRoot, GOOSE_GLOBAL_CONFIG));
  const owned = buildExtensions(canonical.mcp.mcpServers);

  if (existing === null || existing.trim() === '') {
    if (Object.keys(owned).length === 0) return [];
    return [result(yamlStringify({ extensions: owned }), existing)];
  }

  const doc = parseDocument(existing);
  if (doc.errors.length > 0 || !isMap(doc.contents)) return [];

  const current = asObject(doc.toJS() as unknown)?.extensions;
  const merged = { ...unownedExtensions(current), ...owned };
  if (Object.keys(merged).length === 0 && asObject(current) === null) return [];

  doc.set('extensions', merged);
  const content = doc.toString();
  if (content === existing) return [];
  return [result(content, existing)];
}
