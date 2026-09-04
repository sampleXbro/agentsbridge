/**
 * Kimi Code project and global layouts.
 *
 * `~/.kimi-code/config.toml` is deliberately absent from `managedOutputs`: it
 * is the user's own settings file (provider API keys live in it), so stale
 * cleanup must never delete it. Same for the project `.kimi-code` directory
 * itself — only the two directories agentsmesh fully owns are listed.
 *
 * The project file list does include `.kimi-code/AGENTS.md`, which generation
 * never writes: Kimi Code concatenates it WITH the root `AGENTS.md`, so a copy
 * left behind after import would feed the same rules into the prompt twice.
 * `import` reads it first, so the documented import -> generate flow moves the
 * content rather than dropping it. Claude Code lists `.claude/CLAUDE.md` for
 * the same reason.
 */

import type { TargetLayout } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { shouldConvertCommandsToSkills } from '../../config/core/conversions.js';
import { commandSkillDirName } from '../codex-cli/command-skill.js';
import {
  KIMI_CODE_TARGET,
  KIMI_CODE_ROOT_FILE,
  KIMI_CODE_NESTED_ROOT_FILE,
  KIMI_CODE_AGENTS_DIR,
  KIMI_CODE_SKILLS_DIR,
  KIMI_CODE_MCP_FILE,
  KIMI_CODE_GLOBAL_ROOT_FILE,
  KIMI_CODE_GLOBAL_AGENTS_DIR,
  KIMI_CODE_GLOBAL_SKILLS_DIR,
  KIMI_CODE_GLOBAL_MCP_FILE,
} from './constants.js';

function commandPath(name: string, config: ValidatedConfig, skillsDir: string): string | null {
  return shouldConvertCommandsToSkills(config, KIMI_CODE_TARGET)
    ? `${skillsDir}/${commandSkillDirName(name)}/SKILL.md`
    : null;
}

export const projectLayout: TargetLayout = {
  rootInstructionPath: KIMI_CODE_ROOT_FILE,
  skillDir: KIMI_CODE_SKILLS_DIR,
  managedOutputs: {
    dirs: [KIMI_CODE_AGENTS_DIR, KIMI_CODE_SKILLS_DIR],
    files: [KIMI_CODE_ROOT_FILE, KIMI_CODE_NESTED_ROOT_FILE],
    // Kimi Code's own MCP config, in the same directory as the credential-
    // bearing config.toml this layout already refuses to delete.
    coOwnedFiles: [KIMI_CODE_MCP_FILE],
  },
  paths: {
    rulePath() {
      // Non-root rules are embedded in the one instruction file Kimi Code reads.
      return KIMI_CODE_ROOT_FILE;
    },
    commandPath(name, config) {
      return commandPath(name, config, KIMI_CODE_SKILLS_DIR);
    },
    agentPath(name) {
      return `${KIMI_CODE_AGENTS_DIR}/${name}.md`;
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: KIMI_CODE_GLOBAL_ROOT_FILE,
  skillDir: KIMI_CODE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [KIMI_CODE_GLOBAL_AGENTS_DIR, KIMI_CODE_GLOBAL_SKILLS_DIR],
    files: [KIMI_CODE_GLOBAL_ROOT_FILE],
    coOwnedFiles: [KIMI_CODE_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === KIMI_CODE_ROOT_FILE) return KIMI_CODE_GLOBAL_ROOT_FILE;
    // Agents, skills and mcp.json already live under `.kimi-code/`, which the
    // engine rebases under the home directory unchanged.
    return path;
  },
  paths: {
    rulePath() {
      return KIMI_CODE_GLOBAL_ROOT_FILE;
    },
    commandPath(name, config) {
      return commandPath(name, config, KIMI_CODE_GLOBAL_SKILLS_DIR);
    },
    agentPath(name) {
      return `${KIMI_CODE_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};
