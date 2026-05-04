/**
 * Import MCP servers from `.zed/settings.json`.
 *
 * Zed stores MCP servers under the `context_servers` key in its
 * settings file. This helper extracts that section and writes it
 * as canonical `.agentsmesh/mcp.json`.
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { McpServer } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { writeMcpWithMerge } from '../import/mcp-merge.js';
import { ZED_TARGET } from './constants.js';

const ZED_CANONICAL_MCP = '.agentsmesh/mcp.json';

export async function importZedMcp(
  projectRoot: string,
  settingsPath: string,
  results: ImportResult[],
): Promise<void> {
  const raw = await readFileSafe(join(projectRoot, settingsPath));
  if (raw === null) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return;

  const settings = parsed as Record<string, unknown>;
  const rawServers = settings['context_servers'];
  if (rawServers === undefined || rawServers === null || typeof rawServers !== 'object') return;
  if (Array.isArray(rawServers) || Object.keys(rawServers).length === 0) return;

  const mcpServers: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(rawServers as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entry = { ...(value as Record<string, unknown>) };
    delete entry['source'];
    mcpServers[name] = entry as unknown as McpServer;
  }

  if (Object.keys(mcpServers).length === 0) return;

  await writeMcpWithMerge(projectRoot, ZED_CANONICAL_MCP, mcpServers);
  results.push({
    fromTool: ZED_TARGET,
    fromPath: settingsPath,
    toPath: ZED_CANONICAL_MCP,
    feature: 'mcp',
  });
}
