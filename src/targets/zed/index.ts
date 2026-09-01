/**
 * Zed target descriptor.
 *
 * Generation emits:
 *   - `.rules` / `~/.config/zed/AGENTS.md` — root rule + embedded additional rules
 *   - `.agents/skills/`                    — skills, plus commands projected as skills
 *   - `settings.json`                      — MCP servers, ignore globs and
 *                                            (global only) agent tool permissions
 *
 * Import reads the same set back. Zed also reads `AGENTS.md`, `CLAUDE.md` and
 * `.cursorrules` as project fallbacks, but we generate the native `.rules` path.
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import { generateRules, generateCommands, generateSkills } from './generator.js';
import { project, globalLayout } from './layout.js';
import { importFromZed } from './importer.js';
import { lintRules } from './linter.js';
import { lintPermissions, lintIgnore, lintCommands } from './lint.js';
import { emitZedScopedSettings, mergeZedSettings } from './scoped-settings.js';
import { zedScopeExtras } from './scope-extras.js';
import { buildZedImportPaths } from '../../core/reference/import-map-builders.js';
import {
  ZED_TARGET,
  ZED_ROOT_FILE,
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_ROOT_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from './constants.js';

export const target: TargetGenerators = {
  name: ZED_TARGET,
  primaryRootInstructionPath: ZED_ROOT_FILE,
  generateRules,
  generateCommands,
  generateSkills,
  importFrom: importFromZed,
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'embedded',
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'embedded',
  // agent.tool_permissions is a user-settings field; .zed/settings.json is parsed
  // as ProjectSettingsContent and discards it.
  permissions: 'none',
};

const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'embedded',
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'embedded',
  permissions: 'native',
};

export const descriptor = {
  id: ZED_TARGET,
  metadata: {
    displayName: 'Zed',
    category: 'ide',
    officialUrl: 'https://zed.dev',
    shortDescription: 'Collaborative AI editor',
  },
  generators: target,
  capabilities,
  emptyImportMessage:
    'No Zed config found (.rules, .zed/settings.json, or ~/.config/zed/AGENTS.md).',
  lintRules,
  lint: {
    commands: lintCommands,
    permissions: lintPermissions,
    ignore: lintIgnore,
  },
  supportsConversion: { commands: true },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    // `.agents/skills` is deliberately absent: it is shared with codex-cli and
    // friends, so detecting on it would claim Zed in any repo that uses it.
    detectionPaths: [ZED_GLOBAL_ROOT_FILE, ZED_GLOBAL_SETTINGS_FILE],
    layout: globalLayout,
    scopeExtras: zedScopeExtras,
  },
  // No `importer.rules` spec: the `singleFile` runner copies the whole body into
  // `_root.md`, which loses the embedded non-root rules. `rules-import.ts` splits
  // them out first — the runner cannot express that post-processing step yet.
  emitScopedSettings: emitZedScopedSettings,
  mergeGeneratedOutputContent: mergeZedSettings,
  sharedArtifacts: {
    '.agents/skills/': 'consumer',
  },
  buildImportPaths: buildZedImportPaths,
  detectionPaths: [ZED_ROOT_FILE, ZED_SETTINGS_FILE],
  conversionDefaults: { commandsToSkills: true },
} satisfies TargetDescriptor;
