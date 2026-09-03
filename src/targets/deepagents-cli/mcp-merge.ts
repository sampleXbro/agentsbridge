/**
 * `.mcp.json` is the standard MCP file, shared with any other tool that reads
 * it — claude-code writes the same project path. Both targets own exactly
 * `mcpServers`; if they owned different keys their output would diverge and
 * `resolveOutputCollisions` would hard-fail every run for a user who has both
 * enabled and a `.mcp.json` carrying any other top-level key.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { ownedJsonKeysMerger } from '../../core/generate/json-owned-keys.js';
import { DEEPAGENTS_CLI_MCP_FILE, DEEPAGENTS_CLI_GLOBAL_MCP_FILE } from './constants.js';

export const mergeDeepagentsMcpJson: GeneratedOutputMerger = ownedJsonKeysMerger(
  [DEEPAGENTS_CLI_MCP_FILE, DEEPAGENTS_CLI_GLOBAL_MCP_FILE],
  ['mcpServers'],
);
