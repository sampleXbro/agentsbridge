/**
 * Codex CLI-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import {
  createWarning,
  createUnsupportedHookWarning,
  unsupportedHookEventNames,
} from '../../core/lint/shared/helpers.js';
import { isUrlMcpServer } from '../../core/mcp-servers.js';
import { CODEX_SUPPORTED_HOOK_EVENTS } from './constants.js';

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];

  const diagnostics: LintDiagnostic[] = [];
  for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
    if (typeof server.description === 'string' && server.description) {
      diagnostics.push(
        createWarning(
          '.agentsmesh/mcp.json',
          'codex-cli',
          `MCP server "${name}" has a description, but codex-cli does not project MCP descriptions into .codex/config.toml.`,
        ),
      );
    }

    // Remote servers project url/http_headers/bearer_token_env_var (see generator/mcp.ts),
    // but codex-cli has no config.toml key for arbitrary env vars on that transport.
    if (isUrlMcpServer(server) && Object.keys(server.env).length > 0) {
      diagnostics.push(
        createWarning(
          '.agentsmesh/mcp.json',
          'codex-cli',
          `MCP server "${name}" has env vars, but codex-cli does not project env vars for remote (url) MCP servers — only headers/bearer_token_env_var are projected.`,
        ),
      );
    }
  }
  return diagnostics;
}

export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  return unsupportedHookEventNames(canonical.hooks, CODEX_SUPPORTED_HOOK_EVENTS).map((event) =>
    createUnsupportedHookWarning(event, 'codex-cli', CODEX_SUPPORTED_HOOK_EVENTS),
  );
}
