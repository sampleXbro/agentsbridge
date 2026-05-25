/**
 * Seed the agentsmesh self-serve MCP entry into .agentsmesh/mcp.json.
 * Single source of truth for the entry value — used by both init and import flows.
 */

import { resolve, dirname } from 'node:path';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { parseMcp } from '../../canonical/features/mcp.js';

export const MCP_AGENTSMESH_ENTRY_VALUE = {
  type: 'stdio' as const,
  command: 'npx',
  args: ['-y', 'agentsmesh', 'mcp'],
};

/**
 * Inject the agentsmesh entry into a parsed mcp.json structure if absent.
 * Returns true if the structure was modified.
 */
export function injectAgentsmeshEntry(mcpJson: { mcpServers: Record<string, unknown> }): boolean {
  if (mcpJson.mcpServers.agentsmesh !== undefined) return false;
  mcpJson.mcpServers.agentsmesh = MCP_AGENTSMESH_ENTRY_VALUE;
  return true;
}

/**
 * Read .agentsmesh/mcp.json (creating an empty structure if missing), inject the
 * agentsmesh entry if absent, and atomically write back. Returns true if written.
 *
 * On any failure, logs a warning to stderr and returns false (warn-and-continue).
 */
export async function seedAgentsmeshMcpEntry(projectRoot: string): Promise<boolean> {
  const path = resolve(projectRoot, '.agentsmesh/mcp.json');
  try {
    let cfg: { mcpServers: Record<string, unknown> };
    try {
      const parsed = await parseMcp(path);
      cfg = parsed ?? { mcpServers: {} };
    } catch {
      cfg = { mcpServers: {} };
    }
    if (!injectAgentsmeshEntry(cfg)) return false;
    const content = JSON.stringify(cfg, null, 2) + '\n';
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
    await writeFile(tmp, content, 'utf8');
    await rename(tmp, path);
    return true;
  } catch (e) {
    process.stderr.write(
      `[agentsmesh] warning: could not seed agentsmesh MCP server entry into mcp.json: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return false;
  }
}
