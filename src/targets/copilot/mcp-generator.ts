import type { CanonicalFiles } from '../../core/types.js';
import type { GenerateFeatureContext } from '../catalog/target.interface.js';
import { COPILOT_MCP_JSON } from './constants.js';
import type { RulesOutput } from './generator.js';

/**
 * Generate .vscode/mcp.json from canonical MCP servers.
 * GitHub Copilot reads project-scoped MCP configuration from .vscode/mcp.json
 * under the `servers` key (not `mcpServers`).
 * Global scope is not supported — returns empty in global mode.
 */
export function generateMcp(canonical: CanonicalFiles, ctx?: GenerateFeatureContext): RulesOutput[] {
  if (ctx?.scope === 'global') return [];
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  return [
    {
      path: COPILOT_MCP_JSON,
      content: JSON.stringify({ servers: canonical.mcp.mcpServers }, null, 2),
    },
  ];
}
