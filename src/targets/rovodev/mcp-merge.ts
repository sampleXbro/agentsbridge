/**
 * `~/.rovodev/mcp_config.json` is the MCP config the Rovo Dev CLI manages
 * (https://support.atlassian.com/rovo/docs/manage-rovo-dev-cli-settings/) and
 * the only MCP source the importer reads. Writing it from canonical replaced
 * every other top-level key and every per-server field canonical cannot hold.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import {
  CANONICAL_MCP_SERVER_KEYS,
  mcpServersJsonMerger,
} from '../../core/generate/mcp-servers-merge.js';
import { ROVODEV_GLOBAL_MCP_FILE } from './constants.js';

export const mergeRovodevMcpJson: GeneratedOutputMerger = mcpServersJsonMerger(
  [ROVODEV_GLOBAL_MCP_FILE],
  CANONICAL_MCP_SERVER_KEYS,
);
