/**
 * `.codex/config.toml` is the user's own Codex config (model, model_providers,
 * shell_environment_policy, projects trust). agentsmesh owns only the
 * `[mcp_servers.*]` tables.
 *
 * The merge is text-preserving rather than parse-and-reserialize: every line
 * outside an `mcp_servers` table — comments and formatting included — is kept
 * verbatim, and the generated tables replace the old ones. The server set stays
 * exactly canonical's, so a server removed from canonical is still revoked.
 *
 * Only table syntax is recognised; a top-level `mcp_servers = { ... }` inline
 * table is left in place (Codex documents the table form).
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { CODEX_CONFIG_TOML } from './constants.js';

// A table header is a line-leading `[key]` / `[[key]]` with nothing after it.
// Quoted keys may themselves contain brackets — `[projects."/Users/me/[wo]rk"]`
// is a legal header for a legal path — so quoted runs are matched before bare
// ones. Failing to recognise a header leaves `dropping` set from the previous
// `[mcp_servers.*]` table and silently deletes the user's section.
const TABLE_HEADER = /^\s*\[\[?(?:"[^"]*"|'[^']*'|[^[\]"'])*\]\]?\s*(?:#.*)?$/;
const MCP_TABLE_HEADER = /^\s*\[\[?\s*mcp_servers\s*[.\]]/;

function stripMcpServerTables(toml: string): string {
  const kept: string[] = [];
  let dropping = false;
  for (const line of toml.split('\n')) {
    if (TABLE_HEADER.test(line)) dropping = MCP_TABLE_HEADER.test(line);
    if (!dropping) kept.push(line);
  }
  return kept.join('\n').trimEnd();
}

export const mergeCodexConfigToml: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) => {
  if (resolvedPath !== CODEX_CONFIG_TOML) return null;
  const base = pending?.content ?? existing;
  if (base === null) return null;
  const preserved = stripMcpServerTables(base);
  return preserved === '' ? newContent : `${preserved}\n\n${newContent}`;
};
