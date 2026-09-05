/**
 * Codex CLI-specific lint hooks.
 */

import type { CanonicalAgent, CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import {
  createWarning,
  createUnsupportedHookWarning,
  unsupportedHookEventNames,
} from '../../core/lint/shared/helpers.js';
import { isUrlMcpServer } from '../../core/mcp-servers.js';
import { hasAgentValue } from '../antigravity/agents-format.js';
import { CODEX_AGENTS_DIR, CODEX_SUPPORTED_HOOK_EVENTS } from './constants.js';

/** Canonical agent fields `.codex/agents/*.toml` has no key for (see generator/agents.ts). */
const CODEX_DROPPED_AGENT_FIELDS: readonly (keyof CanonicalAgent)[] = [
  'tools',
  'disallowedTools',
  'maxTurns',
  'hooks',
  'skills',
  'memory',
];

/** Wired as `generators.lint` so it runs whenever lint runs, not only with the `rules` feature. */
export function lintAgents(canonical: CanonicalFiles): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  for (const agent of canonical.agents) {
    const dropped = CODEX_DROPPED_AGENT_FIELDS.filter((field) =>
      hasAgentValue(agent, field),
    ).sort();
    if (dropped.length === 0) continue;
    diagnostics.push(
      createWarning(
        agent.source,
        'codex-cli',
        'Codex agent TOML supports name, description, developer_instructions, model, sandbox_mode and mcp_servers; ' +
          `canonical ${dropped.join(', ')} are not projected to ${CODEX_AGENTS_DIR}/${agent.name}.toml.`,
      ),
    );
  }
  return diagnostics;
}

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
