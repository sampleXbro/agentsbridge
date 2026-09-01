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
 * `.openhands/hooks.json` IS listed, so revoking every canonical hook removes
 * it. That is only safe because import reads every documented on-disk shape and
 * `mergeOpenhandsOutput` carries forward the handlers canonical cannot hold
 * (merge.ts): the file is user-authored, and a lossy read would turn the next
 * generate into a delete. `.openhands` itself is never a managed DIRECTORY —
 * hook scripts live beside it.
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
    files: [OPENHANDS_ROOT_FILE, OPENHANDS_MCP_FILE, OPENHANDS_HOOKS_FILE],
  },
  paths,
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: OPENHANDS_GLOBAL_ROOT_FILE,
  skillDir: OPENHANDS_SKILLS_DIR,
  managedOutputs: {
    dirs: MANAGED_DIRS,
    files: [OPENHANDS_GLOBAL_ROOT_FILE, OPENHANDS_MCP_FILE, OPENHANDS_HOOKS_FILE],
  },
  // Everything else already sits at the same relative path under the home dir.
  rewriteGeneratedPath(path) {
    return path === OPENHANDS_ROOT_FILE ? OPENHANDS_GLOBAL_ROOT_FILE : path;
  },
  paths,
};
