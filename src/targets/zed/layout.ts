/**
 * Zed project and global layouts.
 *
 * Global rules go to `~/.config/zed/AGENTS.md` — `crates/paths/src/paths.rs`
 * `agents_file()` resolves `config_dir()/AGENTS.md`, and it is the single
 * personal instruction file that replaced the Rules Library in v1.4.0. There is
 * no second file to put secondary rules in, so they are embedded into it.
 *
 * `settings.json` is deliberately NOT in `managedOutputs`: it holds the user's
 * editor configuration, and stale cleanup deletes every managed file a run did
 * not emit. Revocation inside that file is handled key by key in
 * `settings-overlay.ts` instead.
 */

import type { TargetLayout, TargetLayoutScope } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { shouldConvertCommandsToSkills } from '../../config/core/conversions.js';
import { commandSkillDirName } from '../codex-cli/command-skill.js';
import {
  ZED_TARGET,
  ZED_ROOT_FILE,
  ZED_SETTINGS_FILE,
  ZED_SKILLS_DIR,
  ZED_GLOBAL_ROOT_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
  ZED_GLOBAL_SKILLS_DIR,
} from './constants.js';

function commandPath(
  skillsDir: string,
  name: string,
  config: ValidatedConfig,
  scope: TargetLayoutScope,
): string | null {
  return shouldConvertCommandsToSkills(config, ZED_TARGET, true, scope)
    ? `${skillsDir}/${commandSkillDirName(name)}/SKILL.md`
    : null;
}

export const project: TargetLayout = {
  rootInstructionPath: ZED_ROOT_FILE,
  skillDir: ZED_SKILLS_DIR,
  managedOutputs: {
    dirs: [ZED_SKILLS_DIR],
    files: [ZED_ROOT_FILE],
  },
  paths: {
    rulePath(_slug) {
      return ZED_ROOT_FILE;
    },
    commandPath(name, config) {
      return commandPath(ZED_SKILLS_DIR, name, config, 'project');
    },
    agentPath() {
      return null;
    },
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: ZED_GLOBAL_ROOT_FILE,
  skillDir: ZED_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [ZED_GLOBAL_SKILLS_DIR],
    files: [ZED_GLOBAL_ROOT_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === ZED_ROOT_FILE) return ZED_GLOBAL_ROOT_FILE;
    if (path === ZED_SETTINGS_FILE) return ZED_GLOBAL_SETTINGS_FILE;
    return path;
  },
  paths: {
    rulePath() {
      // One personal instruction file; secondary rules are embedded into it.
      return ZED_GLOBAL_ROOT_FILE;
    },
    commandPath(name, config) {
      return commandPath(ZED_GLOBAL_SKILLS_DIR, name, config, 'global');
    },
    agentPath() {
      return null;
    },
  },
};
