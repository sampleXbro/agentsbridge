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
 *   - `.augment/settings.json`       — MCP servers + hooks + tool permissions (via emitScopedSettings)
 *   - `.augmentignore`               — workspace ignore patterns
 *
 * Import reads all the above paths.
 *
 * Official docs: https://docs.augmentcode.com/setup-augment/guidelines
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
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
import { projectLayout, globalLayout } from './layout.js';
import {
  AUGMENT_CODE_TARGET,
  AUGMENT_CODE_RULES_DIR,
  AUGMENT_CODE_COMMANDS_DIR,
  AUGMENT_CODE_SKILLS_DIR,
  AUGMENT_CODE_SETTINGS_FILE,
  AUGMENT_CODE_IGNORE_FILE,
  AUGMENT_CODE_GLOBAL_RULES_DIR,
  AUGMENT_CODE_GLOBAL_COMMANDS_DIR,
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

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'native',
  permissions: 'native',
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
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
  project: projectLayout,
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
  emitScopedSettings(canonical: CanonicalFiles, _scope, enabledFeatures) {
    const content = buildSettingsContent(canonical, enabledFeatures);
    if (content === null) return [];
    return [{ path: AUGMENT_CODE_SETTINGS_FILE, content }];
  },
  mergeGeneratedOutputContent(existing, pending, newContent, resolvedPath) {
    if (
      resolvedPath === AUGMENT_CODE_SETTINGS_FILE ||
      resolvedPath === AUGMENT_CODE_GLOBAL_SETTINGS_FILE
    ) {
      // mcp, hooks and permissions all land in settings.json — build on the
      // pending write from this run so a later pass keeps the earlier keys.
      return mergeAugmentSettings(pending?.content ?? existing, newContent);
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
