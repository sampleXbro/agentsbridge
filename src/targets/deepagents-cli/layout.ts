/**
 * Deep Agents CLI project and global layout definitions.
 */

import type { TargetLayout } from '../catalog/target-descriptor.js';
import { commandSkillDirName } from '../codex-cli/command-skill.js';
import {
  DEEPAGENTS_CLI_ROOT_FILE,
  DEEPAGENTS_CLI_SKILLS_DIR,
  DEEPAGENTS_CLI_AGENTS_DIR,
  DEEPAGENTS_CLI_MCP_FILE,
  DEEPAGENTS_CLI_GLOBAL_ROOT_FILE,
  DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR,
  DEEPAGENTS_CLI_GLOBAL_AGENTS_DIR,
  DEEPAGENTS_CLI_GLOBAL_MCP_FILE,
  DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE,
} from './constants.js';

export const project: TargetLayout = {
  rootInstructionPath: DEEPAGENTS_CLI_ROOT_FILE,
  skillDir: DEEPAGENTS_CLI_SKILLS_DIR,
  managedOutputs: {
    dirs: [DEEPAGENTS_CLI_SKILLS_DIR, DEEPAGENTS_CLI_AGENTS_DIR],
    files: [DEEPAGENTS_CLI_ROOT_FILE, DEEPAGENTS_CLI_MCP_FILE],
  },
  paths: {
    rulePath(_slug) {
      return DEEPAGENTS_CLI_ROOT_FILE;
    },
    commandPath(name) {
      return `${DEEPAGENTS_CLI_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${DEEPAGENTS_CLI_AGENTS_DIR}/${name}/AGENTS.md`;
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: DEEPAGENTS_CLI_GLOBAL_ROOT_FILE,
  skillDir: DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR, DEEPAGENTS_CLI_GLOBAL_AGENTS_DIR],
    files: [
      DEEPAGENTS_CLI_GLOBAL_ROOT_FILE,
      DEEPAGENTS_CLI_GLOBAL_MCP_FILE,
      DEEPAGENTS_CLI_GLOBAL_HOOKS_FILE,
    ],
  },
  rewriteGeneratedPath(path) {
    if (path === DEEPAGENTS_CLI_ROOT_FILE) return DEEPAGENTS_CLI_GLOBAL_ROOT_FILE;
    if (path === DEEPAGENTS_CLI_MCP_FILE) return DEEPAGENTS_CLI_GLOBAL_MCP_FILE;
    if (path.startsWith(`${DEEPAGENTS_CLI_SKILLS_DIR}/`)) {
      return path.replace(`${DEEPAGENTS_CLI_SKILLS_DIR}/`, `${DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR}/`);
    }
    if (path.startsWith(`${DEEPAGENTS_CLI_AGENTS_DIR}/`)) {
      return path.replace(`${DEEPAGENTS_CLI_AGENTS_DIR}/`, `${DEEPAGENTS_CLI_GLOBAL_AGENTS_DIR}/`);
    }
    return path;
  },
  paths: {
    rulePath(_slug) {
      return DEEPAGENTS_CLI_GLOBAL_ROOT_FILE;
    },
    commandPath(name) {
      return `${DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${DEEPAGENTS_CLI_GLOBAL_AGENTS_DIR}/${name}/AGENTS.md`;
    },
  },
};
