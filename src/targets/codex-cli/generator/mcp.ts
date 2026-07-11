import type { CanonicalFiles, McpServer } from '../../../core/types.js';
import { isStdioMcpServer, isUrlMcpServer } from '../../../core/mcp-servers.js';
import { CODEX_CONFIG_TOML } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateMcp(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const servers = Object.entries(canonical.mcp.mcpServers).filter(
    ([, server]) => isStdioMcpServer(server) || isUrlMcpServer(server),
  );
  if (servers.length === 0) return [];
  const content = serializeMcpToToml(servers);
  return [{ path: CODEX_CONFIG_TOML, content }];
}

function serializeMcpToToml(servers: [string, McpServer][]): string {
  const sections: string[] = [];

  for (const [name, server] of servers) {
    const quotedName = needsTomlQuoting(name) ? `"${name}"` : name;
    const lines: string[] = [`[mcp_servers.${quotedName}]`];

    if (isStdioMcpServer(server)) {
      lines.push(`command = ${JSON.stringify(server.command)}`);
      const argsToml = '[' + server.args.map((arg) => JSON.stringify(arg)).join(', ') + ']';
      lines.push(`args = ${argsToml}`);
      const envToml = tomlInlineTable(server.env);
      if (envToml) lines.push(`env = ${envToml}`);
    } else {
      // Remote / Streamable HTTP transport, per https://developers.openai.com/codex/mcp.
      lines.push(`url = ${JSON.stringify(server.url)}`);
      const headers = { ...server.headers };
      const bearerMatch = /^Bearer \$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(
        headers.Authorization ?? '',
      );
      if (bearerMatch) {
        delete headers.Authorization;
        lines.push(`bearer_token_env_var = ${JSON.stringify(bearerMatch[1])}`);
      }
      const headersToml = tomlInlineTable(headers);
      if (headersToml) lines.push(`http_headers = ${headersToml}`);
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n') + '\n';
}

function tomlInlineTable(entries: Record<string, string>): string | null {
  const pairs = Object.entries(entries);
  if (pairs.length === 0) return null;
  const parts = pairs
    .map(([k, v]) => `${needsTomlQuoting(k) ? JSON.stringify(k) : k} = ${JSON.stringify(v)}`)
    .join(', ');
  return `{ ${parts} }`;
}

function needsTomlQuoting(key: string): boolean {
  return !/^[A-Za-z0-9_-]+$/.test(key);
}
