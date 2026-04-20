import type { CanonicalFiles, StdioMcpServer } from '../../../core/types.js';
import { isStdioMcpServer } from '../../../core/mcp-servers.js';
import { CODEX_CONFIG_TOML } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateMcp(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
  const stdioServers: Record<string, StdioMcpServer> = Object.fromEntries(
    Object.entries(canonical.mcp.mcpServers).flatMap(([name, server]) =>
      isStdioMcpServer(server) ? [[name, server] as const] : [],
    ),
  );
  if (Object.keys(stdioServers).length === 0) return [];
  const content = serializeMcpToToml(stdioServers);
  return [{ path: CODEX_CONFIG_TOML, content }];
}

function serializeMcpToToml(mcpServers: Record<string, StdioMcpServer>): string {
  const sections: string[] = [];

  for (const [name, server] of Object.entries(mcpServers)) {
    const quotedName = needsTomlQuoting(name) ? `"${name}"` : name;
    const lines: string[] = [];
    lines.push(`[mcp_servers.${quotedName}]`);
    lines.push(`command = ${JSON.stringify(server.command)}`);
    const argsToml = '[' + server.args.map((arg) => JSON.stringify(arg)).join(', ') + ']';
    lines.push(`args = ${argsToml}`);

    const envEntries = Object.entries(server.env);
    if (envEntries.length > 0) {
      const envParts = envEntries
        .map(([k, v]) => `${needsTomlQuoting(k) ? JSON.stringify(k) : k} = ${JSON.stringify(v)}`)
        .join(', ');
      lines.push(`env = { ${envParts} }`);
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n') + '\n';
}

function needsTomlQuoting(key: string): boolean {
  return !/^[A-Za-z0-9_-]+$/.test(key);
}
