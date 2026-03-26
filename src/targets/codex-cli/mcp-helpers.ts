/**
 * Codex CLI MCP helpers — TOML server mapping and MCP config import.
 */

import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import type { ImportResult } from '../../core/types.js';
import type { McpServer } from '../../core/types.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { CODEX_CONFIG_TOML } from './constants.js';

const AB_MCP = '.agentsmesh/mcp.json';

export function mapTomlServerToCanonical(raw: unknown): McpServer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const command = typeof obj.command === 'string' ? obj.command : '';
  if (!command) return null;

  const args = Array.isArray(obj.args)
    ? obj.args.filter((x): x is string => typeof x === 'string')
    : [];

  const envRaw = obj.env;
  const env: Record<string, string> =
    envRaw !== null && typeof envRaw === 'object' && !Array.isArray(envRaw)
      ? Object.fromEntries(
          Object.entries(envRaw as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {};

  return {
    type: 'stdio',
    command,
    args,
    env,
  };
}

export async function importMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
  const configPath = join(projectRoot, CODEX_CONFIG_TOML);
  const content = await readFileSafe(configPath);
  if (content === null) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = parseToml(content) as Record<string, unknown>;
  } catch {
    return;
  }

  const rawServers = parsed.mcp_servers;
  if (
    !rawServers ||
    typeof rawServers !== 'object' ||
    Array.isArray(rawServers) ||
    Object.keys(rawServers).length === 0
  ) {
    return;
  }

  const mcpServers: Record<string, McpServer> = {};
  for (const [name, val] of Object.entries(rawServers as Record<string, unknown>)) {
    const server = mapTomlServerToCanonical(val);
    if (server) mcpServers[name] = server;
  }

  if (Object.keys(mcpServers).length === 0) return;

  await mkdirp(join(projectRoot, '.agentsmesh'));
  await writeFileAtomic(join(projectRoot, AB_MCP), JSON.stringify({ mcpServers }, null, 2));
  results.push({
    fromTool: 'codex-cli',
    fromPath: configPath,
    toPath: AB_MCP,
    feature: 'mcp',
  });
}
