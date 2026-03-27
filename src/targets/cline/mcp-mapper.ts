/**
 * Cline MCP server mapping helpers — converts Cline MCP settings to canonical format.
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { McpServer } from '../../core/types.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { CLINE_TARGET, CLINE_MCP_SETTINGS, CLINE_CANONICAL_MCP } from './constants.js';

export function mapClineServerToCanonical(raw: unknown): McpServer | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const command = typeof obj.command === 'string' ? obj.command : '';
  if (!command) return null;
  const type =
    typeof obj.type === 'string'
      ? obj.type
      : typeof obj.transportType === 'string'
        ? obj.transportType
        : 'stdio';
  const args = Array.isArray(obj.args)
    ? obj.args.filter((x): x is string => typeof x === 'string')
    : [];
  const envRaw = obj.env;
  const env: Record<string, string> =
    envRaw !== null && typeof envRaw === 'object' && !Array.isArray(envRaw)
      ? Object.fromEntries(
          Object.entries(envRaw).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {};
  const description = typeof obj.description === 'string' ? obj.description : undefined;
  return {
    ...(description !== undefined && { description }),
    type,
    command,
    args,
    env,
  };
}

export async function importClineMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
  const mcpPath = join(projectRoot, CLINE_MCP_SETTINGS);
  const mcpContent = await readFileSafe(mcpPath);
  if (mcpContent === null) return;

  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = JSON.parse(mcpContent) as Record<string, unknown>;
  } catch {
    // skip malformed
  }
  const mcpServersRaw = parsed?.mcpServers;
  if (
    mcpServersRaw !== undefined &&
    typeof mcpServersRaw === 'object' &&
    mcpServersRaw !== null &&
    Object.keys(mcpServersRaw).length > 0
  ) {
    const mcpServers: Record<string, McpServer> = {};
    for (const [n, val] of Object.entries(mcpServersRaw)) {
      const server = mapClineServerToCanonical(val);
      if (server) mcpServers[n] = server;
    }
    if (Object.keys(mcpServers).length > 0) {
      await mkdirp(join(projectRoot, '.agentsmesh'));
      await writeFileAtomic(
        join(projectRoot, CLINE_CANONICAL_MCP),
        JSON.stringify({ mcpServers }, null, 2),
      );
      results.push({
        fromTool: CLINE_TARGET,
        fromPath: mcpPath,
        toPath: CLINE_CANONICAL_MCP,
        feature: 'mcp',
      });
    }
  }
}
