/**
 * OpenHands output layouts per scope.
 *
 * `managedOutputs` lists only what agentsmesh fills itself. `.agents/skills` and
 * `.agents/agents` hold nothing but agentsmesh artifacts (codex-cli, goose and
 * antigravity make the same call for the same directories), so listing them is
 * what makes revocation work. `.agents/plugins/agentsmesh` is deliberately NOT
 * listed as a directory: goose owns `hooks/hooks.json` inside it, and stale
 * cleanup deletes every file in a managed dir the run did not emit. Only the
 * `commands/` subdirectory and the two files agentsmesh writes are managed.
 *
 * `.openhands/hooks.json` is CO-OWNED, not owned: it is the user's own OpenHands
 * config file and holds `HookType.AGENT` handlers plus per-handler `name`,
 * `async` and `max_iterations` keys canonical cannot express (merge.ts). Deleting
 * it would destroy those, so it is never a stale-cleanup target. Revocation still
 * works, event-scoped rather than file-scoped: agentsmesh rewrites the handlers
 * of every event it emits, so a hook removed from canonical is dropped from the
 * file. The one case it no longer covers is emptying canonical hooks entirely,
 * where the run emits nothing and the previous handlers stay — the safe trade,
 * because the same code path fires when the `hooks` feature is disabled.
 * `.openhands` itself is never a managed DIRECTORY — hook scripts live beside it.
 */

import type { TargetLayout } from '../catalog/target-descriptor.js';
import {
  OPENHANDS_ROOT_FILE,
  OPENHANDS_SKILLS_DIR,
  OPENHANDS_AGENTS_DIR,
  OPENHANDS_COMMANDS_DIR,
  OPENHANDS_MCP_FILE,
  OPENHANDS_HOOKS_FILE,
  OPENHANDS_GLOBAL_ROOT_FILE,
} from './constants.js';

const MANAGED_DIRS = [OPENHANDS_AGENTS_DIR, OPENHANDS_SKILLS_DIR, OPENHANDS_COMMANDS_DIR];

const paths: TargetLayout['paths'] = {
  rulePath(slug) {
    return `${OPENHANDS_SKILLS_DIR}/${slug}.md`;
  },
  commandPath(name) {
    return `${OPENHANDS_COMMANDS_DIR}/${name}.md`;
  },
  agentPath(name) {
    return `${OPENHANDS_AGENTS_DIR}/${name}.md`;
  },
};

export const projectLayout: TargetLayout = {
  rootInstructionPath: OPENHANDS_ROOT_FILE,
  skillDir: OPENHANDS_SKILLS_DIR,
  managedOutputs: {
    dirs: MANAGED_DIRS,
    files: [OPENHANDS_ROOT_FILE, OPENHANDS_MCP_FILE],
    coOwnedFiles: [OPENHANDS_HOOKS_FILE],
  },
  paths,
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: OPENHANDS_GLOBAL_ROOT_FILE,
  skillDir: OPENHANDS_SKILLS_DIR,
  managedOutputs: {
    dirs: MANAGED_DIRS,
    files: [OPENHANDS_GLOBAL_ROOT_FILE, OPENHANDS_MCP_FILE],
    coOwnedFiles: [OPENHANDS_HOOKS_FILE],
  },
  // Everything else already sits at the same relative path under the home dir.
  rewriteGeneratedPath(path) {
    return path === OPENHANDS_ROOT_FILE ? OPENHANDS_GLOBAL_ROOT_FILE : path;
  },
  paths,
};
