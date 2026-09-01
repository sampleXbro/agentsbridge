/**
 * Codebuff output layouts per scope.
 *
 * `managedOutputs` deliberately lists `.agents/skills` but NEVER `.agents`
 * itself. `cleanupStaleGeneratedOutputs` deletes every file under a managed
 * directory the run did not emit, and `.agents/` is where the user keeps their
 * own agent modules, `types/agent-definition.ts` and `package.json` (see the
 * `initial-agents-dir` template in the Freebuff repo). Listing it would wipe
 * the user's agents on the first generate.
 *
 * Nested `<dir>/AGENTS.md` files are also absent: they live in arbitrary source
 * directories alongside user code, so no cleanup rule can safely claim them.
 * The cost is that removing a scoped rule from canonical leaves its nested file
 * behind — the same limitation Codex CLI has for the same paths.
 *
 * `.agents/mcp.json` and `.codebuffignore` ARE listed. Both are single-purpose
 * files agentsmesh owns end to end (`mcpFileSchema` is exactly `{ mcpServers }`),
 * so listing them is what makes revocation work — the same call Claude Code
 * makes for `.mcp.json`/`.claudeignore` and Cursor for `.cursor/mcp.json`.
 * Contrast goose's `config.yaml` or zed's `settings.json`, which are omitted
 * because agentsmesh owns only a few keys inside a wider user config.
 */

import type { TargetLayout, TargetLayoutScope } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { shouldConvertCommandsToSkills } from '../../config/core/conversions.js';
import { commandSkillDirName } from '../codex-cli/command-skill.js';
import { renderCodebuffGlobalInstructions } from './generator.js';
import { codebuffNestedKnowledgePath } from './rule-paths.js';
import {
  CODEBUFF_TARGET,
  CODEBUFF_ROOT_FILE,
  CODEBUFF_SKILLS_DIR,
  CODEBUFF_MCP_FILE,
  CODEBUFF_IGNORE_FILE,
  CODEBUFF_GLOBAL_ROOT_FILE,
  CODEBUFF_GLOBAL_SKILLS_DIR,
  CODEBUFF_GLOBAL_MCP_FILE,
} from './constants.js';

function commandPath(
  skillsDir: string,
  name: string,
  config: ValidatedConfig,
  scope: TargetLayoutScope,
): string | null {
  return shouldConvertCommandsToSkills(config, CODEBUFF_TARGET, true, scope)
    ? `${skillsDir}/${commandSkillDirName(name)}/SKILL.md`
    : null;
}

export const projectLayout: TargetLayout = {
  rootInstructionPath: CODEBUFF_ROOT_FILE,
  skillDir: CODEBUFF_SKILLS_DIR,
  managedOutputs: {
    dirs: [CODEBUFF_SKILLS_DIR],
    files: [CODEBUFF_ROOT_FILE, CODEBUFF_MCP_FILE, CODEBUFF_IGNORE_FILE],
  },
  paths: {
    rulePath(_slug, rule) {
      return codebuffNestedKnowledgePath(rule);
    },
    commandPath(name, config) {
      return commandPath(CODEBUFF_SKILLS_DIR, name, config, 'project');
    },
    agentPath() {
      return null;
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: CODEBUFF_GLOBAL_ROOT_FILE,
  renderPrimaryRootInstruction: renderCodebuffGlobalInstructions,
  skillDir: CODEBUFF_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [CODEBUFF_GLOBAL_SKILLS_DIR],
    files: [CODEBUFF_GLOBAL_ROOT_FILE, CODEBUFF_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === CODEBUFF_ROOT_FILE) return CODEBUFF_GLOBAL_ROOT_FILE;
    // Nested knowledge files come from a project directory walk that has no
    // home-directory counterpart; global scope embeds those rules instead.
    if (path.endsWith('/AGENTS.md')) return null;
    if (path === CODEBUFF_IGNORE_FILE) return null;
    return path;
  },
  paths: {
    rulePath() {
      return CODEBUFF_GLOBAL_ROOT_FILE;
    },
    commandPath(name, config) {
      return commandPath(CODEBUFF_GLOBAL_SKILLS_DIR, name, config, 'global');
    },
    agentPath() {
      return null;
    },
  },
};
