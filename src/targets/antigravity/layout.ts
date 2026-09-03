/**
 * Antigravity output layouts per scope.
 *
 * `.agents/agents/` (project) and `.gemini/config/agents/` (global) ARE managed.
 * `cleanupStaleGeneratedOutputs` is the only eviction path, so leaving them out
 * makes revocation a no-op: an agent deleted from canonical keeps running in
 * Antigravity with its `tools:` grant and a later import resurrects it. Both
 * directories hold nothing but agent files agentsmesh also writes, which is the
 * same call claude-code makes for `.claude/agents` — unlike `.continue/agents`,
 * which additionally holds user `*.yaml` assistant profiles.
 *
 * `.gemini/antigravity-cli/settings.json` stays out entirely: it is the user's
 * own settings file that agentsmesh only folds a `permissions` key into (see
 * `global-permissions.ts`), so cleanup would delete the whole file.
 *
 * The MCP config files are `coOwnedFiles`, not `files`: Antigravity's own UI
 * writes per-server `cwd` / `disabled` / `oauth` keys into them (see
 * `mcp-settings.ts`), so disabling the `mcp` feature must leave them in place.
 */

import type { TargetLayout } from '../catalog/target-descriptor.js';
import { renderAntigravityGlobalInstructions } from './generator.js';
import {
  ANTIGRAVITY_AGENTS_DIR,
  ANTIGRAVITY_GLOBAL_AGENTS_DIR,
  ANTIGRAVITY_GLOBAL_HOOKS_FILE,
  ANTIGRAVITY_GLOBAL_MCP_CONFIG,
  ANTIGRAVITY_GLOBAL_ROOT,
  ANTIGRAVITY_GLOBAL_SKILLS_DIR,
  ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR,
  ANTIGRAVITY_HOOKS_FILE,
  ANTIGRAVITY_IGNORE_FILE,
  ANTIGRAVITY_MCP_CONFIG,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_SKILLS_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
} from './constants.js';

/** `<name>.md` (project) becomes `<name>/agent.md` (global). */
function globalAgentPath(name: string): string {
  return `${ANTIGRAVITY_GLOBAL_AGENTS_DIR}/${name}/agent.md`;
}

export const projectLayout: TargetLayout = {
  rootInstructionPath: ANTIGRAVITY_RULES_ROOT,
  skillDir: ANTIGRAVITY_SKILLS_DIR,
  // Antigravity emits across three fully-managed dirs:
  //   - `.agents/rules`     (rules)
  //   - `.agents/workflows` (commands → workflows projection)
  //   - `.agents/skills`    (skills)
  // Without all three here, projected outputs from an uninstalled pack would
  // linger in the user's project. Single-file outputs are listed under `files`
  // so revoking them (empty canonical hooks/ignore) removes them from disk.
  managedOutputs: {
    dirs: [
      ANTIGRAVITY_AGENTS_DIR,
      ANTIGRAVITY_RULES_DIR,
      ANTIGRAVITY_WORKFLOWS_DIR,
      ANTIGRAVITY_SKILLS_DIR,
    ],
    files: [ANTIGRAVITY_RULES_ROOT, ANTIGRAVITY_IGNORE_FILE],
    // hooks.json is keyed by user-chosen handler names and there is no hooks
    // importer, so an overwritten handler is unrecoverable (see hooks-merge.ts).
    coOwnedFiles: [ANTIGRAVITY_MCP_CONFIG, ANTIGRAVITY_HOOKS_FILE],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${ANTIGRAVITY_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${ANTIGRAVITY_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${ANTIGRAVITY_AGENTS_DIR}/${name}.md`;
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: ANTIGRAVITY_GLOBAL_ROOT,
  renderPrimaryRootInstruction: renderAntigravityGlobalInstructions,
  skillDir: ANTIGRAVITY_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      ANTIGRAVITY_GLOBAL_AGENTS_DIR,
      ANTIGRAVITY_GLOBAL_SKILLS_DIR,
      ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR,
    ],
    files: [ANTIGRAVITY_GLOBAL_ROOT],
    coOwnedFiles: [ANTIGRAVITY_GLOBAL_MCP_CONFIG, ANTIGRAVITY_GLOBAL_HOOKS_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === ANTIGRAVITY_HOOKS_FILE) return ANTIGRAVITY_GLOBAL_HOOKS_FILE;
    if (path === ANTIGRAVITY_RULES_ROOT) return ANTIGRAVITY_GLOBAL_ROOT;
    if (path.startsWith(`${ANTIGRAVITY_RULES_DIR}/`)) return null;
    // No home-directory ignore file is documented for Antigravity.
    if (path === ANTIGRAVITY_IGNORE_FILE) return null;
    if (path.startsWith(`${ANTIGRAVITY_AGENTS_DIR}/`)) {
      return globalAgentPath(path.slice(ANTIGRAVITY_AGENTS_DIR.length + 1).replace(/\.md$/, ''));
    }
    if (path.startsWith(`${ANTIGRAVITY_SKILLS_DIR}/`)) {
      return path.replace(ANTIGRAVITY_SKILLS_DIR, ANTIGRAVITY_GLOBAL_SKILLS_DIR);
    }
    if (path.startsWith(`${ANTIGRAVITY_WORKFLOWS_DIR}/`)) {
      return path.replace(ANTIGRAVITY_WORKFLOWS_DIR, ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR);
    }
    if (path === ANTIGRAVITY_MCP_CONFIG) return ANTIGRAVITY_GLOBAL_MCP_CONFIG;
    return path;
  },
  paths: {
    rulePath(_slug, _rule) {
      return ANTIGRAVITY_GLOBAL_ROOT;
    },
    commandPath(name, _config) {
      return `${ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(name) {
      // Return the global path directly so consumers that build a reference
      // map (e.g. `agentTargetPath` in `core/reference/map-targets.ts`) don't
      // rely on `rewriteGeneratedPath` running after them.
      return globalAgentPath(name);
    },
  },
};
