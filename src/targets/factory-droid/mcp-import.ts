/**
 * Import MCP servers from `.factory/mcp.json`.
 *
 * Factory Droid stores MCP servers in the standard `mcpServers` format
 * inside `.factory/mcp.json`. This helper extracts that section and
 * writes it as canonical `.agentsmesh/mcp.json`.
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { McpServer } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { writeMcpWithMerge } from '../import/mcp-merge.js';
import { FACTORY_DROID_TARGET } from './constants.js';

const CANONICAL_MCP = '.agentsmesh/mcp.json';

export async function importFactoryDroidMcp(
  projectRoot: string,
  mcpPath: string,
  results: ImportResult[],
): Promise<void> {
  const raw = await readFileSafe(join(projectRoot, mcpPath));
  if (raw === null) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return;

  const settings = parsed as Record<string, unknown>;
  const rawServers = settings['mcpServers'];
  if (rawServers === undefined || rawServers === null || typeof rawServers !== 'object') return;
  if (Array.isArray(rawServers) || Object.keys(rawServers).length === 0) return;

  const mcpServers: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(rawServers as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    mcpServers[name] = value as McpServer;
  }

  if (Object.keys(mcpServers).length === 0) return;

  await writeMcpWithMerge(projectRoot, CANONICAL_MCP, mcpServers);
  results.push({
    fromTool: FACTORY_DROID_TARGET,
    fromPath: mcpPath,
    toPath: CANONICAL_MCP,
    feature: 'mcp',
  });
}
