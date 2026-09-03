/**
 * Three Junie files, three ownership rules.
 *
 *   - `~/.junie/config.json` — pre-existing behaviour: keep every key.
 *   - `.junie/mcp/mcp.json` (both scopes, one string) — the project and user
 *     MCP config Junie's IDE/CLI settings UI writes
 *     (docs/agent-structures/junie-project-level-advanced.md); agentsmesh owns
 *     the server set only.
 *   - `~/.junie/allowlist.json` — the persistent Action Allowlist: every
 *     command the user accepts with "Always allow" lands here
 *     (https://junie.jetbrains.com/docs/action-allowlist-junie-cli.html).
 *     agentsmesh maps canonical permissions into ONE category, so it owns
 *     `rules.executables` and nothing else — not `defaultBehavior`, not
 *     `allowReadonlyCommands`, and not the `fileEditing` / `mcpTools` /
 *     `readOutsideProject` / `readSecretFile` categories it used to blank.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { ownedJsonSubKeysMerger } from '../../core/generate/json-owned-keys.js';
import {
  CANONICAL_MCP_SERVER_KEYS,
  mcpServersJsonMerger,
} from '../../core/generate/mcp-servers-merge.js';
import { mergeJunieConfig } from './global-config.js';
import {
  JUNIE_GLOBAL_ALLOWLIST,
  JUNIE_GLOBAL_CONFIG,
  JUNIE_GLOBAL_MCP_FILE,
  JUNIE_MCP_FILE,
} from './constants.js';

const mergeMcp = mcpServersJsonMerger(
  [JUNIE_MCP_FILE, JUNIE_GLOBAL_MCP_FILE],
  CANONICAL_MCP_SERVER_KEYS,
);
const mergeAllowlist = ownedJsonSubKeysMerger([JUNIE_GLOBAL_ALLOWLIST], 'rules', ['executables']);

export const mergeJunieOutput: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) => {
  if (resolvedPath === JUNIE_GLOBAL_CONFIG) return mergeJunieConfig(existing, newContent);
  return (
    mergeMcp(existing, pending, newContent, resolvedPath) ??
    mergeAllowlist(existing, pending, newContent, resolvedPath)
  );
};
