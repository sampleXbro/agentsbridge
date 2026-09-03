/**
 * Entry-scoped merge for JSON config files keyed by `mcpServers`.
 *
 * Three targets write an `mcpServers` map into a file the tool itself also
 * writes (Antigravity's `mcp_config.json`, Goose's plugin `.mcp.json`, Copilot
 * CLI's `~/.copilot/mcp-config.json`). Each needs the same two guarantees, so
 * the rule lives here once rather than being re-derived per target:
 *
 *   - the server SET is exactly canonical's, so a server dropped from canonical
 *     is revoked rather than left running;
 *   - within a surviving server, every key canonical cannot express (`cwd`,
 *     `disabled`, a `tools` allow-list, oauth wiring) is carried over from disk,
 *     and so is every top-level key of the file.
 */

import type { GeneratedOutputMerger } from '../../targets/catalog/target-descriptor.js';
import { preservedUnparsableBase } from './json-owned-keys.js';

/**
 * The per-server keys canonical can express — exactly the fields of `McpServer`
 * (`src/core/mcp-types.ts`). Every target whose MCP file is keyed by
 * `mcpServers` owns this set and nothing else, so two targets writing the same
 * path can never disagree and trip `resolveOutputCollisions`. A target whose
 * serializer emits an extra field (Kimi Code's `transport`) appends to it.
 */
export const CANONICAL_MCP_SERVER_KEYS: readonly string[] = [
  'type',
  'command',
  'args',
  'env',
  'url',
  'headers',
  'description',
];

type Json = Record<string, unknown>;

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

/**
 * Merge canonical's `mcpServers` into `base`, keeping foreign top-level keys and
 * the per-server keys outside `ownedServerKeys`.
 *
 * @returns Merged JSON; the base verbatim when it is present but unparsable; or
 * `newContent` when there is no base to merge into.
 *
 * A base we cannot parse is a file we do not understand — MCP config files are
 * comment-legal in several tools — so it is preserved rather than replaced, the
 * same rule `preservedUnparsableBase` applies to every other JSON merger.
 */
export function mergeMcpServersJson(
  base: string | null,
  newContent: string,
  ownedServerKeys: readonly string[],
): string {
  if (base !== null) {
    const preserved = preservedUnparsableBase(base);
    if (preserved !== null) return preserved;
  }
  const baseRoot = base === null ? null : parseJson(base);
  if (baseRoot === null) return newContent;

  const baseServers = serverObjects(baseRoot);
  const nextServers = serverObjects(parseJson(newContent));
  const merged: Json = {};
  for (const [name, entry] of Object.entries(nextServers)) {
    const carried: Json = {};
    for (const [key, value] of Object.entries(asObject(baseServers[name]) ?? {})) {
      if (!ownedServerKeys.includes(key)) carried[key] = value;
    }
    merged[name] = { ...(entry as Json), ...carried };
  }
  return JSON.stringify({ ...baseRoot, mcpServers: merged }, null, 2);
}

/** Builds a `mergeGeneratedOutputContent` hook for `paths`. */
export function mcpServersJsonMerger(
  paths: readonly string[],
  ownedServerKeys: readonly string[],
): GeneratedOutputMerger {
  return (existing, pending, newContent, resolvedPath) =>
    paths.includes(resolvedPath)
      ? mergeMcpServersJson(pending?.content ?? existing, newContent, ownedServerKeys)
      : null;
}
