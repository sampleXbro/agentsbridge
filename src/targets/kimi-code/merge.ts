/**
 * `.kimi-code/mcp.json` / `~/.kimi-code/mcp.json` is Kimi Code's own MCP config
 * (constants.ts documents it as the project-scope file Kimi resolves ahead of
 * `.mcp.json`), and `importKimiMcp` reads it per scope. It sits in the same
 * directory as the credential-bearing `config.toml` the layout already refuses
 * to delete — the same reasoning was never applied to this file.
 *
 * `transport` is owned too: `serializeKimiMcpServer` writes it from the server
 * shape, so carrying a stale value over from disk would contradict canonical.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import {
  CANONICAL_MCP_SERVER_KEYS,
  mcpServersJsonMerger,
} from '../../core/generate/mcp-servers-merge.js';
import { KIMI_CODE_MCP_FILE, KIMI_CODE_GLOBAL_MCP_FILE } from './constants.js';

export const mergeKimiCodeMcpJson: GeneratedOutputMerger = mcpServersJsonMerger(
  [KIMI_CODE_MCP_FILE, KIMI_CODE_GLOBAL_MCP_FILE],
  [...CANONICAL_MCP_SERVER_KEYS, 'transport'],
);
