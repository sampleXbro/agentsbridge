/**
 * `.amazonq/mcp.json` and `~/.aws/amazonq/mcp.json` are the files
 * `q mcp add --scope workspace|global` writes
 * (https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-understanding-config.html),
 * which is why `amazonQImporterSpec` reads both. Writing them from canonical
 * alone dropped every other top-level key and the per-server `timeout` and
 * `disabled` flags Q owns — a disabled server silently re-enabled itself.
 *
 * The two paths are distinct strings, so the merger claims both (a merger that
 * claimed only one would leave the twin on whole-file replacement).
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import {
  CANONICAL_MCP_SERVER_KEYS,
  mcpServersJsonMerger,
} from '../../core/generate/mcp-servers-merge.js';
import { AMAZON_Q_MCP_FILE, AMAZON_Q_GLOBAL_MCP_FILE } from './constants.js';

export const mergeAmazonQMcpJson: GeneratedOutputMerger = mcpServersJsonMerger(
  [AMAZON_Q_MCP_FILE, AMAZON_Q_GLOBAL_MCP_FILE],
  CANONICAL_MCP_SERVER_KEYS,
);
