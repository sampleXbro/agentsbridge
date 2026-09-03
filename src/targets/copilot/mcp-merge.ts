/**
 * `.vscode/mcp.json` is a shared VS Code file: its `inputs` array holds the
 * user's secret-prompt definitions and other extensions read the same file.
 * agentsmesh owns only the `servers` key.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { ownedJsonKeysMerger } from '../../core/generate/json-owned-keys.js';
import { COPILOT_MCP_JSON } from './constants.js';

export const mergeCopilotMcpJson: GeneratedOutputMerger = ownedJsonKeysMerger(
  [COPILOT_MCP_JSON],
  ['servers'],
);
