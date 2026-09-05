/**
 * Cursor-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';
import { unmappedCursorHookEvents } from './hook-format.js';

/** Warn when canonical hook events have no Cursor equivalent (dropped on generate). */
export function lintHooks(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.hooks) return [];
  const unmapped = unmappedCursorHookEvents(canonical.hooks);
  if (unmapped.length === 0) return [];
  return [
    createWarning(
      '.agentsmesh/hooks.yaml',
      'cursor',
      `Cursor has no equivalent for hook event(s) ${unmapped.join(', ')}; they are not projected to .cursor/hooks.json.`,
    ),
  ];
}

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  return canonical.commands
    .filter((command) => command.allowedTools.length > 0)
    .map((command) =>
      createWarning(
        command.source,
        'cursor',
        'Cursor command files project only description frontmatter; allowed-tools metadata is not projected.',
      ),
    );
}

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];

  const diagnostics: LintDiagnostic[] = [];
  for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
    // Check for env vars or URL/header interpolation
    const hasEnv = server.env && Object.keys(server.env).length > 0;
    const hasUrl = 'url' in server;
    const hasHeaders = 'headers' in server;

    if (hasEnv || hasUrl || hasHeaders) {
      diagnostics.push(
        createWarning(
          '.agentsmesh/mcp.json',
          'cursor',
          `MCP server "${name}" uses env vars or URL/header interpolation; Cursor handling may differ from canonical MCP.`,
        ),
      );
    }
  }
  return diagnostics;
}

/**
 * Permissions are native for cursor (written to .cursor/cli.json / ~/.cursor/cli-config.json).
 * No lint warning is needed — the round-trip is lossless for allow/deny entries.
 * The `ask` category has no Cursor equivalent, but that is a silent omission by design
 * (Cursor's default for unlisted tools is to prompt, matching the `ask` semantic).
 */
export function lintPermissions(_canonical: CanonicalFiles): LintDiagnostic[] {
  return [];
}
