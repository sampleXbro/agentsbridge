/**
 * Windsurf-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { createWarning } from '../../core/lint/shared/helpers.js';

export function lintCommands(canonical: CanonicalFiles): LintDiagnostic[] {
  return canonical.commands
    .filter((command) => command.description.length > 0 || command.allowedTools.length > 0)
    .map((command) =>
      createWarning(
        command.source,
        'windsurf',
        'windsurf workflow files are plain Markdown; command description and allowed-tools metadata are not projected.',
      ),
    );
}

export function lintMcp(canonical: CanonicalFiles): LintDiagnostic[] {
  if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];

  return [
    createWarning(
      '.agentsmesh/mcp.json',
      'windsurf',
      'Windsurf MCP is partial; generated .windsurf/mcp_config.example.json is a reference artifact and may require manual setup.',
    ),
  ];
}
