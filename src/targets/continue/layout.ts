/**
 * Continue output layouts per scope.
 *
 * `.continue/settings.json` is listed under `coOwnedFiles`, never `files`: it is
 * a user-owned file (description, disableAllHooks, future keys) that agentsmesh
 * only folds a `hooks` key into. Listing it under `files` would make stale
 * cleanup delete the whole file whenever canonical hooks are empty; leaving it
 * out of `managedOutputs` altogether (as it used to be) hid it from the
 * revocation invariant, so an emptied `hooks.yaml` left the key live.
 *
 * `.continue/agents` is absent for the same reason: the directory is shared with
 * artifacts agentsmesh never writes — user assistant profiles (`*.yaml`, loaded
 * by `ConfigHandler.getLocalProfiles` at both scopes) and hand-written agent
 * files. `cleanupStaleGeneratedOutputs` deletes every file in a managed dir that
 * the current run did not emit, so listing it would destroy them. The trade-off
 * is that an agent removed from canonical leaves its `.md` behind.
 */

import type { TargetLayout } from '../catalog/target-descriptor.js';
import { continueAgentFilePath } from './agent-file.js';
import { continueCommandRulePath } from './command-rule.js';
import {
  CONTINUE_SETTINGS,
  CONTINUE_GLOBAL_AGENTS_MD,
  CONTINUE_GLOBAL_CONFIG,
  CONTINUE_GLOBAL_IGNORE,
  CONTINUE_GLOBAL_PERMISSIONS,
  CONTINUE_IGNORE,
  CONTINUE_MCP_FILE,
  CONTINUE_PROMPTS_DIR,
  CONTINUE_ROOT_RULE,
  CONTINUE_RULES_DIR,
  CONTINUE_SKILLS_DIR,
} from './constants.js';

export const projectLayout: TargetLayout = {
  rootInstructionPath: CONTINUE_ROOT_RULE,
  skillDir: CONTINUE_SKILLS_DIR,
  managedOutputs: {
    dirs: [CONTINUE_PROMPTS_DIR, CONTINUE_RULES_DIR, CONTINUE_SKILLS_DIR],
    files: [CONTINUE_MCP_FILE, CONTINUE_IGNORE],
    coOwnedFiles: [CONTINUE_SETTINGS],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${CONTINUE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return continueCommandRulePath(name);
    },
    agentPath(name) {
      return continueAgentFilePath(name);
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: CONTINUE_ROOT_RULE,
  outputFamilies: [
    { id: 'compat-agents', kind: 'additional', explicitPaths: [CONTINUE_GLOBAL_AGENTS_MD] },
  ],
  skillDir: CONTINUE_SKILLS_DIR,
  managedOutputs: {
    dirs: [CONTINUE_RULES_DIR, CONTINUE_PROMPTS_DIR, CONTINUE_SKILLS_DIR, '.agents/skills'],
    files: [CONTINUE_MCP_FILE, CONTINUE_GLOBAL_AGENTS_MD, CONTINUE_GLOBAL_IGNORE],
    // `config.yaml` is the user's personal assistant config (models, apiKey,
    // context providers) and `permissions.yaml` is written by Continue itself
    // when the user approves a tool; agentsmesh owns only some keys of each.
    coOwnedFiles: [CONTINUE_GLOBAL_CONFIG, CONTINUE_GLOBAL_PERMISSIONS, CONTINUE_SETTINGS],
  },
  mirrorGlobalPath(path, _activeTargets) {
    if (path.startsWith(`${CONTINUE_SKILLS_DIR}/`)) {
      return `.agents/skills/${path.slice(CONTINUE_SKILLS_DIR.length + 1)}`;
    }
    return null;
  },
  paths: {
    rulePath(slug, _rule) {
      return `${CONTINUE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${CONTINUE_PROMPTS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return continueAgentFilePath(name);
    },
  },
};
