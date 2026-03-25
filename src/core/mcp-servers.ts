import type { McpServer, StdioMcpServer, UrlMcpServer } from './types.js';

const INTERPOLATION_PATTERN = /\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*/;

export function isStdioMcpServer(server: McpServer): server is StdioMcpServer {
  return 'command' in server;
}

export function isUrlMcpServer(server: McpServer): server is UrlMcpServer {
  return 'url' in server;
}

export function hasInterpolation(value: string): boolean {
  return INTERPOLATION_PATTERN.test(value);
}

export function usesCursorSensitiveInterpolation(server: McpServer): boolean {
  if (Object.keys(server.env).length > 0) return true;
  if (!isUrlMcpServer(server)) return false;
  if (hasInterpolation(server.url)) return true;
  return Object.values(server.headers).some(hasInterpolation);
}
