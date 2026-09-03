/**
 * Copilot writes MCP servers at two paths, with two schemas and two owners.
 *
 * `.vscode/mcp.json` is a shared VS Code file: its `inputs` array holds the
 * user's secret-prompt definitions and other extensions read the same file.
 * agentsmesh owns only the `servers` key.
 *
 * `~/.copilot/mcp-config.json` is the file `copilot mcp add` writes, keyed by
 * `mcpServers`. agentsmesh owns the server set (so a server dropped from
 * canonical is revoked) but not the per-server fields canonical cannot express —
 * the `tools` allow-list and the enabled/disabled state — nor any other
 * top-level key of the file.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { ownedJsonKeysMerger } from '../../core/generate/json-owned-keys.js';
import { mcpServersJsonMerger } from '../../core/generate/mcp-servers-merge.js';
import { COPILOT_MCP_JSON, COPILOT_GLOBAL_MCP } from './constants.js';

/** Per-server keys agentsmesh writes from canonical; everything else carries over. */
const COPILOT_OWNED_SERVER_KEYS = [
  'type',
  'command',
  'args',
  'env',
  'url',
  'headers',
  'description',
];

const mergeProjectMcpJson = ownedJsonKeysMerger([COPILOT_MCP_JSON], ['servers']);
const mergeGlobalMcpConfig = mcpServersJsonMerger([COPILOT_GLOBAL_MCP], COPILOT_OWNED_SERVER_KEYS);

export const mergeCopilotMcpJson: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) =>
  mergeProjectMcpJson(existing, pending, newContent, resolvedPath) ??
  mergeGlobalMcpConfig(existing, pending, newContent, resolvedPath);
