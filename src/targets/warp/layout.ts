/**
 * Warp project and global layout definitions.
 */

import type { TargetLayout } from '../catalog/target-descriptor.js';
import { commandSkillDirName } from '../codex-cli/command-skill.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import {
  WARP_ROOT_FILE,
  WARP_SKILLS_DIR,
  WARP_MCP_FILE,
  WARP_IGNORE_FILE,
  WARP_GLOBAL_ROOT_FILE,
  WARP_GLOBAL_SKILLS_DIR,
  WARP_GLOBAL_MCP_FILE,
} from './constants.js';

export const project: TargetLayout = {
  rootInstructionPath: WARP_ROOT_FILE,
  skillDir: WARP_SKILLS_DIR,
  managedOutputs: {
    dirs: [WARP_SKILLS_DIR],
    files: [WARP_ROOT_FILE, WARP_IGNORE_FILE],
    // The MCP config Warp reads and users author; agentsmesh owns only the
    // server set inside it (see merge.ts).
    coOwnedFiles: [WARP_MCP_FILE],
  },
  paths: {
    rulePath(_slug) {
      return WARP_ROOT_FILE;
    },
    commandPath(name) {
      return `${WARP_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${WARP_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: WARP_GLOBAL_ROOT_FILE,
  skillDir: WARP_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [WARP_GLOBAL_SKILLS_DIR],
    files: [WARP_GLOBAL_ROOT_FILE],
    coOwnedFiles: [WARP_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === WARP_ROOT_FILE) return WARP_GLOBAL_ROOT_FILE;
    if (path.startsWith(`${WARP_SKILLS_DIR}/`)) {
      return path.replace(`${WARP_SKILLS_DIR}/`, `${WARP_GLOBAL_SKILLS_DIR}/`);
    }
    // No home-level indexing-ignore file is documented, only a GUI
    // indexed-folders control; lintIgnore reports the drop.
    if (path === WARP_IGNORE_FILE) return null;
    // The MCP generator already emits the global path (`.warp/.mcp.json`)
    // directly when scope is global, so it passes through unchanged.
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, WARP_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath() {
      // Warp documents machine-wide rules as one file; secondary rules are
      // embedded into it (globalCapabilities.additionalRules === 'embedded').
      return WARP_GLOBAL_ROOT_FILE;
    },
    commandPath(name) {
      return `${WARP_GLOBAL_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${WARP_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};
