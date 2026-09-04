/**
 * Kiro project and global layouts.
 *
 * `managedOutputs` deliberately omits `.kiro/settings/permissions.yaml`: it is
 * the user's own permission file, written key-scoped by
 * `generateKiroGlobalPermissions`, and stale cleanup deletes every listed file
 * a run did not emit.
 */

import type { TargetLayout } from '../catalog/target-descriptor.js';
import { commandSkillDirName } from '../codex-cli/command-skill.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import {
  KIRO_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_AGENTS_DIR,
  KIRO_HOOKS_DIR,
  KIRO_MCP_FILE,
  KIRO_IGNORE,
  KIRO_GLOBAL_STEERING_DIR,
  KIRO_GLOBAL_STEERING_AGENTS_MD,
  KIRO_GLOBAL_SKILLS_DIR,
  KIRO_GLOBAL_AGENTS_DIR,
  KIRO_GLOBAL_MCP_FILE,
  KIRO_GLOBAL_IGNORE,
  KIRO_GLOBAL_AGENTS_SKILLS_DIR,
} from './constants.js';

export const projectLayout: TargetLayout = {
  rootInstructionPath: KIRO_AGENTS_MD,
  skillDir: KIRO_SKILLS_DIR,
  managedOutputs: {
    dirs: [KIRO_HOOKS_DIR, KIRO_SKILLS_DIR, KIRO_STEERING_DIR, KIRO_AGENTS_DIR],
    files: [KIRO_AGENTS_MD, KIRO_IGNORE],
    // Kiro's own MCP config: its MCP UI writes `disabled`, `autoApprove` and
    // `disabledTools` back into it (see merge.ts).
    coOwnedFiles: [KIRO_MCP_FILE],
  },
  paths: {
    rulePath(slug, _rule) {
      return `${KIRO_STEERING_DIR}/${slug}.md`;
    },
    commandPath(name) {
      return `${KIRO_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name, _config) {
      return `${KIRO_AGENTS_DIR}/${name}.md`;
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: KIRO_GLOBAL_STEERING_AGENTS_MD,
  skillDir: KIRO_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      KIRO_GLOBAL_STEERING_DIR,
      KIRO_GLOBAL_SKILLS_DIR,
      KIRO_GLOBAL_AGENTS_DIR,
      KIRO_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [KIRO_GLOBAL_STEERING_AGENTS_MD, KIRO_GLOBAL_IGNORE],
    coOwnedFiles: [KIRO_GLOBAL_MCP_FILE],
  },
  rewriteGeneratedPath(path) {
    // Transform project-level paths to global ~/.kiro/ paths
    if (path === KIRO_AGENTS_MD) {
      return KIRO_GLOBAL_STEERING_AGENTS_MD;
    }
    if (path.startsWith(`${KIRO_STEERING_DIR}/`)) {
      return path.replace(`${KIRO_STEERING_DIR}/`, `${KIRO_GLOBAL_STEERING_DIR}/`);
    }
    if (path.startsWith(`${KIRO_SKILLS_DIR}/`)) {
      return path.replace(`${KIRO_SKILLS_DIR}/`, `${KIRO_GLOBAL_SKILLS_DIR}/`);
    }
    if (path.startsWith(`${KIRO_AGENTS_DIR}/`)) {
      return path.replace(`${KIRO_AGENTS_DIR}/`, `${KIRO_GLOBAL_AGENTS_DIR}/`);
    }
    if (path === KIRO_MCP_FILE) {
      return KIRO_GLOBAL_MCP_FILE;
    }
    if (path === KIRO_IGNORE) {
      return KIRO_GLOBAL_IGNORE;
    }
    // Skip hooks in global mode
    if (path.startsWith(`${KIRO_HOOKS_DIR}/`)) {
      return null;
    }
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, KIRO_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath(slug, _rule) {
      return `${KIRO_GLOBAL_STEERING_DIR}/${slug}.md`;
    },
    commandPath(name) {
      return `${KIRO_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name, _config) {
      return `${KIRO_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};
