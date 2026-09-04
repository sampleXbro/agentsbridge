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

import { ownedYamlKeysMerger } from '../../core/generate/yaml-owned-keys.js';
import { GOOSE_GLOBAL_PERMISSIONS } from './constants.js';
import type { CanonicalFiles } from '../../core/types.js';
import type { GeneratedOutputMerger, TargetLayoutScope } from '../catalog/target-descriptor.js';
import { mcpServersJsonMerger } from '../../core/generate/mcp-servers-merge.js';
import {
  GOOSE_OWNED_MCP_SERVER_KEYS,
  hasGooseProjectMcpServers,
  serializeGooseProjectMcp,
} from './mcp-format.js';
import { GOOSE_PROJECT_MCP_FILE } from './constants.js';

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

const mergeGooseMcpJson: GeneratedOutputMerger = mcpServersJsonMerger(
  [GOOSE_PROJECT_MCP_FILE],
  GOOSE_OWNED_MCP_SERVER_KEYS,
);

/**
 * `~/.config/goose/permission.yaml` is keyed by permission category and
 * agentsmesh owns only `user`; `smart_approve` is Goose's own runtime cache.
 * The merge used to live inside `serializeGoosePermissions`, which meant the
 * shared policy had no way to write a revocation there. Declaring it here also
 * buys comment preservation, which the reserialize-based merge did not have.
 */
const mergeGoosePermissionsYaml: GeneratedOutputMerger = ownedYamlKeysMerger(
  [GOOSE_GLOBAL_PERMISSIONS],
  ['user'],
);

export const mergeGooseMcpContent: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) =>
  mergeGooseMcpJson(existing, pending, newContent, resolvedPath) ??
  mergeGoosePermissionsYaml(existing, pending, newContent, resolvedPath);
