/**
 * Project MCP emission for Goose: `.agents/plugins/agentsmesh/.mcp.json`.
 *
 * Routed through `emitScopedSettings` instead of `generators.generateMcp`.
 * Both paths now apply the shared merge policy (`core/generate/merge-policy.ts`),
 * so this routing is structural. Without the merge below the file is rewritten
 * whole from canonical, which erases
 * `cwd` — a real `McpServerConfig` field (`crates/goose/src/plugins/mcp_servers.rs`)
 * that canonical has no home for — and any unknown top-level key such as
 * `$schema`.
 *
 * The merge is key-scoped, never file-scoped: the server set stays exactly
 * canonical's stdio set, so a server removed from canonical is still revoked and
 * a remote entry is still removed (with `command` required, one remote entry
 * would stop goose loading ANY server in the file).
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { GeneratedOutputMerger, TargetLayoutScope } from '../catalog/target-descriptor.js';
import {
  GOOSE_OWNED_MCP_SERVER_KEYS,
  hasGooseProjectMcpServers,
  serializeGooseProjectMcp,
} from './mcp-format.js';
import { GOOSE_PROJECT_MCP_FILE } from './constants.js';

type Json = Record<string, unknown>;

/** Global scope writes the `config.yaml` extensions block instead (global-mcp.ts). */
export function emitGooseProjectMcp(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): readonly { readonly path: string; readonly content: string }[] {
  if (scope === 'global' || !enabledFeatures.has('mcp')) return [];
  if (!hasGooseProjectMcpServers(canonical.mcp)) return [];
  return [{ path: GOOSE_PROJECT_MCP_FILE, content: serializeGooseProjectMcp(canonical.mcp!) }];
}

function asObject(value: unknown): Json | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Json;
}

function parseJson(content: string): Json | null {
  try {
    return asObject(JSON.parse(content));
  } catch {
    return null;
  }
}

function serverObjects(root: Json | null): Json {
  const raw = asObject(root?.mcpServers);
  if (!raw) return {};
  const out: Json = {};
  for (const [name, value] of Object.entries(raw)) {
    const entry = asObject(value);
    if (entry) out[name] = entry;
  }
  return out;
}

/** Keys of an on-disk entry canonical cannot express, so generate keeps them. */
function carriedOverKeys(existing: unknown): Json {
  const entry = asObject(existing);
  if (!entry) return {};
  const out: Json = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!GOOSE_OWNED_MCP_SERVER_KEYS.includes(key)) out[key] = value;
  }
  return out;
}

export const mergeGooseMcpContent: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) => {
  if (resolvedPath !== GOOSE_PROJECT_MCP_FILE) return null;
  const base = pending?.content ?? existing;
  const baseRoot = base === null ? null : parseJson(base);
  if (baseRoot === null) return newContent;

  const baseServers = serverObjects(baseRoot);
  const nextServers = serverObjects(parseJson(newContent));
  const merged: Json = {};
  for (const [name, entry] of Object.entries(nextServers)) {
    merged[name] = { ...(entry as Json), ...carriedOverKeys(baseServers[name]) };
  }
  return JSON.stringify({ ...baseRoot, mcpServers: merged }, null, 2);
};
