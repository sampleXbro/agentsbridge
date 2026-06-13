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
import { generateRules, generateCommands, generateSkills, generateIgnore } from './generator.js';
import { importFromAugmentCode } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks } from './lint.js';
import { buildAugmentCodeImportPaths } from '../../core/reference/import-map-builders.js';
import type { CanonicalFiles } from '../../core/types.js';
import type { Hooks } from '../../core/hook-types.js';
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
  generateSkills,
  generateIgnore,
  importFrom: importFromAugmentCode,
};

/**
 * Serialize canonical hooks to AugmentCode settings.json hooks format.
 * AugmentCode: { event: [{ matcher, hooks: [{ type, command, timeout }] }] }
 */
function serializeHooksForSettings(hooks: Hooks): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!entries || entries.length === 0) continue;
    const serialized = entries.map((entry) => ({
      matcher: entry.matcher,
      hooks: [
        {
          type: 'command',
          command: entry.command,
          ...(entry.timeout !== undefined ? { timeout: entry.timeout } : {}),
        },
      ],
    }));
    result[event] = serialized;
  }
  return result;
}

function mergeAugmentSettings(existing: string | null, newContent: string): string {
  if (existing === null) return newContent;
  let base: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(existing);
    base =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    base = {};
  }
  const incoming: unknown = JSON.parse(newContent);
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) return existing;
  const overlay = incoming as Record<string, unknown>;
  if (overlay.mcpServers !== undefined) base.mcpServers = overlay.mcpServers;
  if (overlay.hooks !== undefined) base.hooks = overlay.hooks;
  return JSON.stringify(base, null, 2);
}

function buildSettingsContent(
  canonical: CanonicalFiles,
  enabledFeatures: ReadonlySet<string>,
): string | null {
  const settings: Record<string, unknown> = {};

  if (
    enabledFeatures.has('mcp') &&
    canonical.mcp &&
    Object.keys(canonical.mcp.mcpServers).length > 0
  ) {
    settings.mcpServers = canonical.mcp.mcpServers;
  }

  if (enabledFeatures.has('hooks') && canonical.hooks && Object.keys(canonical.hooks).length > 0) {
    settings.hooks = serializeHooksForSettings(canonical.hooks);
  }

  if (Object.keys(settings).length === 0) return null;
  return JSON.stringify(settings, null, 2);
}

const project: TargetLayout = {
  skillDir: AUGMENT_CODE_SKILLS_DIR,
  managedOutputs: {
    dirs: [AUGMENT_CODE_RULES_DIR, AUGMENT_CODE_COMMANDS_DIR, AUGMENT_CODE_SKILLS_DIR],
    files: [AUGMENT_CODE_SETTINGS_FILE, AUGMENT_CODE_IGNORE_FILE],
  },
  paths: {
    rulePath(slug) {
      return `${AUGMENT_CODE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name) {
      return `${AUGMENT_CODE_COMMANDS_DIR}/${name}.md`;
    },
    agentPath(_name) {
      return null;
    },
  },
};

const globalLayout: TargetLayout = {
  skillDir: AUGMENT_CODE_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [
      AUGMENT_CODE_GLOBAL_RULES_DIR,
      AUGMENT_CODE_GLOBAL_COMMANDS_DIR,
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
    agentPath(_name) {
      return null;
    },
  },
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'none',
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
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
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
  emitScopedSettings(canonical: CanonicalFiles, _scope, enabledFeatures) {
    const content = buildSettingsContent(canonical, enabledFeatures);
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
