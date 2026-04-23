import type { CanonicalFiles } from '../../../core/types.js';
import { WINDSURF_MCP_EXAMPLE_FILE } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateMcp(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: WINDSURF_MCP_EXAMPLE_FILE,
      content: JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}
