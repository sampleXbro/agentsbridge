/**
 * `.mcp.json` (project) and `.claude.json` (global) are shared user files:
 * `~/.claude.json` holds the whole Claude Code account and project state
 * (oauthAccount, projects, history) and agentsmesh owns only `mcpServers`.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { ownedJsonKeysMerger } from '../../core/generate/json-owned-keys.js';
import { CLAUDE_MCP_JSON, CLAUDE_GLOBAL_MCP_JSON } from './constants.js';

// `mcpServers` must match deepagents-cli, which writes the same `.mcp.json`.
export const mergeClaudeMcpJson: GeneratedOutputMerger = ownedJsonKeysMerger(
  [CLAUDE_MCP_JSON, CLAUDE_GLOBAL_MCP_JSON],
  ['mcpServers'],
);
