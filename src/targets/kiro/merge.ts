/**
 * `.kiro/settings/mcp.json` and `~/.kiro/settings/mcp.json` are Kiro's own MCP
 * config files (https://kiro.dev/docs/mcp/configuration/): Kiro merges the two
 * layers and writes them from its MCP UI, which is why the importer reads both.
 *
 * Rewriting the file from canonical dropped `disabled`, `autoApprove` and
 * `disabledTools` — Kiro-only per-server properties canonical has no home for —
 * so a server the user disabled came back enabled on every generate.
 *
 * Both constants resolve to the same string, so one path entry covers both
 * scopes; `coOwnedFiles` still has to be declared in each layout.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import {
  CANONICAL_MCP_SERVER_KEYS,
  mcpServersJsonMerger,
} from '../../core/generate/mcp-servers-merge.js';
import { KIRO_MCP_FILE, KIRO_GLOBAL_MCP_FILE } from './constants.js';

export const mergeKiroMcpJson: GeneratedOutputMerger = mcpServersJsonMerger(
  [KIRO_MCP_FILE, KIRO_GLOBAL_MCP_FILE],
  CANONICAL_MCP_SERVER_KEYS,
);
