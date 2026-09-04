/**
 * `.warp/.mcp.json` / `~/.warp/.mcp.json` is the MCP config Warp consumes
 * (https://docs.warp.dev/knowledge-and-collaboration/mcp) and the file the
 * importer reads at both scopes — agentsmesh only has something to import
 * because the user's servers already live there. Writing it from canonical
 * replaced the whole document.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import {
  CANONICAL_MCP_SERVER_KEYS,
  mcpServersJsonMerger,
} from '../../core/generate/mcp-servers-merge.js';
import { WARP_MCP_FILE, WARP_GLOBAL_MCP_FILE } from './constants.js';

export const mergeWarpMcpJson: GeneratedOutputMerger = mcpServersJsonMerger(
  [WARP_MCP_FILE, WARP_GLOBAL_MCP_FILE],
  CANONICAL_MCP_SERVER_KEYS,
);
