interface BaseMcpServer {
  description?: string;
  type: string;
  env: Record<string, string>;
}

/** Stdio MCP server configuration */
export interface StdioMcpServer extends BaseMcpServer {
  command: string;
  args: string[];
}

/** URL-based MCP server configuration (HTTP/SSE/streamable HTTP) */
export interface UrlMcpServer extends BaseMcpServer {
  url: string;
  headers: Record<string, string>;
}

/** MCP server configuration */
export type McpServer = StdioMcpServer | UrlMcpServer;

export interface McpConfig {
  mcpServers: Record<string, McpServer>;
}
