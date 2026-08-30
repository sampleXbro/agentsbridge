/**
 * AugmentCode file layouts.
 *
 * Project scope writes `.augment/` at the repo root; global scope writes the
 * same tree under `~/.augment/`. Only the rules, commands and skills
 * directories differ between the two, so global generation reuses the project
 * paths and rewrites them.
 */

import type { TargetLayout } from '../catalog/target-descriptor.js';
import {
  AUGMENT_CODE_RULES_DIR,
  AUGMENT_CODE_COMMANDS_DIR,
  AUGMENT_CODE_AGENTS_DIR,
  AUGMENT_CODE_SKILLS_DIR,
  AUGMENT_CODE_SETTINGS_FILE,
  AUGMENT_CODE_IGNORE_FILE,
  AUGMENT_CODE_GLOBAL_RULES_DIR,
  AUGMENT_CODE_GLOBAL_COMMANDS_DIR,
  AUGMENT_CODE_GLOBAL_AGENTS_DIR,
  AUGMENT_CODE_GLOBAL_SKILLS_DIR,
  AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
} from './constants.js';

export const projectLayout: TargetLayout = {
  skillDir: AUGMENT_CODE_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      AUGMENT_CODE_RULES_DIR,
      AUGMENT_CODE_COMMANDS_DIR,
      AUGMENT_CODE_AGENTS_DIR,
      AUGMENT_CODE_SKILLS_DIR,
    ],
    files: [AUGMENT_CODE_SETTINGS_FILE, AUGMENT_CODE_IGNORE_FILE],
  },
  paths: {
    rulePath(slug) {
      return `${AUGMENT_CODE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name) {
      return `${AUGMENT_CODE_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${AUGMENT_CODE_AGENTS_DIR}/${name}.md`;
    },
  },
};

export const globalLayout: TargetLayout = {
  skillDir: AUGMENT_CODE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      AUGMENT_CODE_GLOBAL_RULES_DIR,
      AUGMENT_CODE_GLOBAL_COMMANDS_DIR,
      AUGMENT_CODE_GLOBAL_AGENTS_DIR,
      AUGMENT_CODE_GLOBAL_SKILLS_DIR,
    ],
    files: [AUGMENT_CODE_GLOBAL_SETTINGS_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path.startsWith(`${AUGMENT_CODE_RULES_DIR}/`)) {
      return path.replace(`${AUGMENT_CODE_RULES_DIR}/`, `${AUGMENT_CODE_GLOBAL_RULES_DIR}/`);
    }
    if (path.startsWith(`${AUGMENT_CODE_COMMANDS_DIR}/`)) {
      return path.replace(`${AUGMENT_CODE_COMMANDS_DIR}/`, `${AUGMENT_CODE_GLOBAL_COMMANDS_DIR}/`);
    }
    // AUGMENT_CODE_AGENTS_DIR === AUGMENT_CODE_GLOBAL_AGENTS_DIR ('.augment/agents'),
    // so no path rewrite needed — agent paths are identical in project and global scope.
    if (path.startsWith(`${AUGMENT_CODE_SKILLS_DIR}/`)) {
      return path.replace(`${AUGMENT_CODE_SKILLS_DIR}/`, `${AUGMENT_CODE_GLOBAL_SKILLS_DIR}/`);
    }
    if (path === AUGMENT_CODE_SETTINGS_FILE) {
      return AUGMENT_CODE_GLOBAL_SETTINGS_FILE;
    }
    // Ignore project-only paths in global mode
    if (path === AUGMENT_CODE_IGNORE_FILE) {
      return null;
    }
    return path;
  },
  paths: {
    rulePath(slug) {
      return `${AUGMENT_CODE_GLOBAL_RULES_DIR}/${slug}.md`;
    },
    commandPath(name) {
      return `${AUGMENT_CODE_GLOBAL_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${AUGMENT_CODE_GLOBAL_AGENTS_DIR}/${name}.md`;
    },
  },
};
