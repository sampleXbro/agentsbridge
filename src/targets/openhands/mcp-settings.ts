/**
 * MCP emission for OpenHands: `.agents/plugins/agentsmesh/.mcp.json`.
 *
 * That file is the Open Plugin Specification `.mcp.json` goose already writes at
 * the same path, so the serializer AND the merge callback are goose's, verbatim.
 * Two enabled targets rewriting one path with different bytes hard-fails the
 * run; reusing both halves keeps them identical, and the merge is what preserves
 * on-disk keys canonical has no home for (`cwd`, `$schema`).
 *
 * Only stdio servers are written: goose's `McpServerConfig` requires `command`,
 * so a single remote entry stops it loading ANY server from the shared file.
 * `lintMcp` names every server dropped for that reason.
 *
 * Routed through `emitScopedSettings` rather than `generators.generateMcp`
 * because only that path hands the target its merge callback.
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { hasGooseProjectMcpServers, serializeGooseProjectMcp } from '../goose/mcp-format.js';
import { OPENHANDS_MCP_FILE } from './constants.js';

/** Both scopes: `~/.agents/plugins/` is discovered the same way as the project tree. */
export function emitOpenhandsMcp(
  canonical: CanonicalFiles,
  _scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): readonly { readonly path: string; readonly content: string }[] {
  if (!enabledFeatures.has('mcp')) return [];
  if (!hasGooseProjectMcpServers(canonical.mcp)) return [];
  return [{ path: OPENHANDS_MCP_FILE, content: serializeGooseProjectMcp(canonical.mcp!) }];
}
