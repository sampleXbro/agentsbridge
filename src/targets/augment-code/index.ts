/**
 * AugmentCode target descriptor.
 *
 * AugmentCode is a commercial AI coding assistant with VS Code and JetBrains
 * extensions, plus the Auggie CLI terminal agent.
 *
 * Generation emits:
 *   - `.augment/rules/*.md`          — scoped rules (always_apply / agent_requested)
 *   - `.augment/commands/*.md`       — slash commands
 *   - `.augment/skills/<n>/SKILL.md` — native skill bundles
 *   - `.augment/settings.json`       — MCP servers + hooks (via emitScopedSettings)
 *   - `.augmentignore`               — workspace ignore patterns
 *
 * Import reads all the above paths.
 *
 * Official docs: https://docs.augmentcode.com/setup-augment/guidelines
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateIgnore,
} from './generator.js';
import { importFromAugmentCode } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks } from './lint.js';
import { buildAugmentCodeImportPaths } from '../../core/reference/import-map-builders.js';
import { buildSettingsContent, mergeAugmentSettings } from './settings-build.js';
import type { CanonicalFiles } from '../../core/types.js';
import {
  AUGMENT_CODE_TARGET,
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

export const target: TargetGenerators = {
  name: AUGMENT_CODE_TARGET,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateIgnore,
  importFrom: importFromAugmentCode,
};

const project: TargetLayout = {
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

const globalLayout: TargetLayout = {
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

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'native',
  permissions: 'none',
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'native',
};

export const descriptor = {
  id: AUGMENT_CODE_TARGET,
  metadata: {
    displayName: 'Augment Code',
    category: 'ide',
    officialUrl: 'https://www.augmentcode.com',
    shortDescription: 'Codebase-aware AI for IDEs',
  },
  generators: target,
  capabilities,
  emptyImportMessage:
    'No AugmentCode config found (.augment/rules, .augment/commands, .augment/skills, .augment/settings.json, or .augmentignore).',
  lintRules,
  lint: {
    hooks: lintHooks,
  },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      AUGMENT_CODE_GLOBAL_RULES_DIR,
      AUGMENT_CODE_GLOBAL_COMMANDS_DIR,
      AUGMENT_CODE_GLOBAL_SKILLS_DIR,
      AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
    ],
    layout: globalLayout,
  },
  emitScopedSettings(canonical: CanonicalFiles, scope, enabledFeatures) {
    const content = buildSettingsContent(canonical, enabledFeatures, scope);
    if (content === null) return [];
    return [{ path: AUGMENT_CODE_SETTINGS_FILE, content }];
  },
  mergeGeneratedOutputContent(existing, _pending, newContent, resolvedPath) {
    if (
      resolvedPath === AUGMENT_CODE_SETTINGS_FILE ||
      resolvedPath === AUGMENT_CODE_GLOBAL_SETTINGS_FILE
    ) {
      return mergeAugmentSettings(existing, newContent);
    }
    return null;
  },
  buildImportPaths: buildAugmentCodeImportPaths,
  detectionPaths: [
    AUGMENT_CODE_RULES_DIR,
    AUGMENT_CODE_COMMANDS_DIR,
    AUGMENT_CODE_SKILLS_DIR,
    AUGMENT_CODE_SETTINGS_FILE,
    AUGMENT_CODE_IGNORE_FILE,
  ],
} satisfies TargetDescriptor;
