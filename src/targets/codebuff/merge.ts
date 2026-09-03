/**
 * `.agents/mcp.json` sits inside the user-scaffolded `.agents/` tree (see
 * layout.ts) and the importer reads it at both scopes, so it is hand-authored
 * config rather than an agentsmesh sidecar. No in-repo evidence shows Codebuff
 * WRITING it, so the safe reading wins: merge the server set in and never
 * delete the file.
 *
 * The owned per-server set stays the canonical one even though
 * `serializeCodebuffMcp` emits a narrower shape — `mcpConfigSchema` is a
 * `z.strictObject`, so carrying an unknown key over from disk would make
 * Codebuff discard every server in the file.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import {
  CANONICAL_MCP_SERVER_KEYS,
  mcpServersJsonMerger,
} from '../../core/generate/mcp-servers-merge.js';
import { CODEBUFF_MCP_FILE, CODEBUFF_GLOBAL_MCP_FILE } from './constants.js';

export const mergeCodebuffMcpJson: GeneratedOutputMerger = mcpServersJsonMerger(
  [CODEBUFF_MCP_FILE, CODEBUFF_GLOBAL_MCP_FILE],
  CANONICAL_MCP_SERVER_KEYS,
);
