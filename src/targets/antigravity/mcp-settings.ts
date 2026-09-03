/**
 * MCP emission for both scopes.
 *
 * Routed through `emitScopedSettings` instead of `generators.generateMcp`.
 * Both paths now apply the shared merge policy (`core/generate/merge-policy.ts`),
 * so this routing is structural, not load-bearing. Without the merge below the
 * generated file would wipe the Antigravity-only per-server keys documented at antigravity.google/docs/mcp/
 * (`cwd`, `disabled`, `disabledTools`, `oauth`, `authProviderType`) — canonical
 * has no home for them, so a `disabled: true` server would silently re-enable
 * itself on the next generate.
 *
 * The merge is key-scoped, never file-scoped: the server set is exactly
 * canonical's, so a server removed from canonical is still revoked, and the
 * keys agentsmesh owns for a server are always rewritten from canonical.
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { GeneratedOutputMerger, TargetLayoutScope } from '../catalog/target-descriptor.js';
import { serializeAntigravityMcp, ANTIGRAVITY_OWNED_SERVER_KEYS } from './mcp-format.js';
import { ANTIGRAVITY_GLOBAL_MCP_CONFIG, ANTIGRAVITY_MCP_CONFIG } from './constants.js';

type Json = Record<string, unknown>;

/** Emits the project path; the global layout rewrites it to `.gemini/config/`. */
export function emitAntigravityMcp(
  canonical: CanonicalFiles,
  _scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): readonly { readonly path: string; readonly content: string }[] {
  if (!enabledFeatures.has('mcp')) return [];
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [{ path: ANTIGRAVITY_MCP_CONFIG, content: serializeAntigravityMcp(canonical.mcp) }];
}

function asObject(value: unknown): Json | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Json;
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

/** Keys of an on-disk entry that canonical cannot express, so generate keeps them. */
function carriedOverKeys(existing: unknown): Json {
  const entry = asObject(existing);
  if (!entry) return {};
  const out: Json = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!ANTIGRAVITY_OWNED_SERVER_KEYS.includes(key)) out[key] = value;
  }
  return out;
}

function parseJson(content: string): Json | null {
  try {
    return asObject(JSON.parse(content));
  } catch {
    return null;
  }
}

export const mergeAntigravityMcpContent: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) => {
  if (resolvedPath !== ANTIGRAVITY_MCP_CONFIG && resolvedPath !== ANTIGRAVITY_GLOBAL_MCP_CONFIG) {
    return null;
  }
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
