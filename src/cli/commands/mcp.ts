import { startServer } from '../../mcp/server.js';
import { redirectLoggerToStderr } from '../../utils/output/logger.js';

export async function runMcp(
  _flags: Record<string, string | boolean>,
  _args: string[],
): Promise<void> {
  // Redirect all logger stdout writes to stderr so that stdout carries only
  // the JSON-RPC stream produced by the MCP SDK transport.
  redirectLoggerToStderr();

  await startServer();
}
