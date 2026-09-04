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
import { mcpServersJsonMerger } from '../../core/generate/mcp-servers-merge.js';
import { serializeAntigravityMcp, ANTIGRAVITY_OWNED_SERVER_KEYS } from './mcp-format.js';
import { ANTIGRAVITY_GLOBAL_MCP_CONFIG, ANTIGRAVITY_MCP_CONFIG } from './constants.js';

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

export const mergeAntigravityMcpContent: GeneratedOutputMerger = mcpServersJsonMerger(
  [ANTIGRAVITY_MCP_CONFIG, ANTIGRAVITY_GLOBAL_MCP_CONFIG],
  ANTIGRAVITY_OWNED_SERVER_KEYS,
);
