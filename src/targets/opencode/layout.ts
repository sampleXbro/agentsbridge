import type { TargetCapabilities } from '../catalog/target.interface.js';
import type { TargetLayout } from '../catalog/target-descriptor.js';
import { mirrorSkillsToAgents } from '../catalog/skill-mirror.js';
import {
  OPENCODE_ROOT_RULE,
  OPENCODE_RULES_DIR,
  OPENCODE_COMMANDS_DIR,
  OPENCODE_AGENTS_DIR,
  OPENCODE_SKILLS_DIR,
  OPENCODE_CONFIG_FILE,
  OPENCODE_GLOBAL_AGENTS_MD,
  OPENCODE_GLOBAL_RULES_DIR,
  OPENCODE_GLOBAL_COMMANDS_DIR,
  OPENCODE_GLOBAL_AGENTS_DIR,
  OPENCODE_GLOBAL_SKILLS_DIR,
  OPENCODE_GLOBAL_CONFIG_FILE,
  OPENCODE_GLOBAL_AGENTS_SKILLS_DIR,
} from './constants.js';

export const project: TargetLayout = {
  rootInstructionPath: OPENCODE_ROOT_RULE,
  skillDir: OPENCODE_SKILLS_DIR,
  managedOutputs: {
    dirs: [OPENCODE_RULES_DIR, OPENCODE_COMMANDS_DIR, OPENCODE_AGENTS_DIR, OPENCODE_SKILLS_DIR],
    files: [OPENCODE_ROOT_RULE, OPENCODE_CONFIG_FILE],
  },
  paths: {
    rulePath: (slug) => `${OPENCODE_RULES_DIR}/${slug}.md`,
    commandPath: (name) => `${OPENCODE_COMMANDS_DIR}/${name}.md`,
    agentPath: (name) => `${OPENCODE_AGENTS_DIR}/${name}.md`,
  },
};

export const globalLayout: TargetLayout = {
  rootInstructionPath: OPENCODE_GLOBAL_AGENTS_MD,
  skillDir: OPENCODE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      OPENCODE_GLOBAL_RULES_DIR,
      OPENCODE_GLOBAL_COMMANDS_DIR,
      OPENCODE_GLOBAL_AGENTS_DIR,
      OPENCODE_GLOBAL_SKILLS_DIR,
      OPENCODE_GLOBAL_AGENTS_SKILLS_DIR,
    ],
    files: [OPENCODE_GLOBAL_AGENTS_MD, OPENCODE_GLOBAL_CONFIG_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === OPENCODE_ROOT_RULE) return OPENCODE_GLOBAL_AGENTS_MD;
    if (path === OPENCODE_CONFIG_FILE) return OPENCODE_GLOBAL_CONFIG_FILE;
    return path;
  },
  mirrorGlobalPath(path, activeTargets) {
    return mirrorSkillsToAgents(path, OPENCODE_GLOBAL_SKILLS_DIR, activeTargets);
  },
  paths: {
    rulePath: (slug) => `${OPENCODE_GLOBAL_RULES_DIR}/${slug}.md`,
    commandPath: (name) => `${OPENCODE_GLOBAL_COMMANDS_DIR}/${name}.md`,
    agentPath: (name) => `${OPENCODE_GLOBAL_AGENTS_DIR}/${name}.md`,
  },
};

export const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'partial',
  ignore: 'embedded',
  permissions: 'native',
};
