import type { CanonicalFiles } from '../../../core/types.js';
import { CURSOR_MCP } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateMcp(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const content = JSON.stringify({ mcpServers: canonical.mcp.mcpServers }, null, 2);
  return [{ path: CURSOR_MCP, content }];
}
