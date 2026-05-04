/**
 * Import MCP servers from `.amp/settings.json`.
 *
 * Amp stores MCP servers under the `amp.mcpServers` key in its
 * workspace settings file. This helper extracts that section and
 * writes it as canonical `.agentsmesh/mcp.json`.
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { McpServer } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { writeMcpWithMerge } from '../import/mcp-merge.js';
import { AMP_TARGET } from './constants.js';

const AMP_CANONICAL_MCP = '.agentsmesh/mcp.json';

export async function importAmpMcp(
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
  const rawServers = settings['amp.mcpServers'] ?? settings['mcpServers'];
  if (rawServers === undefined || rawServers === null || typeof rawServers !== 'object') return;
  if (Array.isArray(rawServers) || Object.keys(rawServers).length === 0) return;

  const mcpServers: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(rawServers as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    mcpServers[name] = value as McpServer;
  }

  if (Object.keys(mcpServers).length === 0) return;

  await writeMcpWithMerge(projectRoot, AMP_CANONICAL_MCP, mcpServers);
  results.push({
    fromTool: AMP_TARGET,
    fromPath: settingsPath,
    toPath: AMP_CANONICAL_MCP,
    feature: 'mcp',
  });
}
