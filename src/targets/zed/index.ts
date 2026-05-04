/**
 * Zed target descriptor.
 *
 * Generation emits:
 *   - `.rules`              — root rule + embedded additional rules
 *   - `.zed/settings.json`  — MCP servers (via emitScopedSettings)
 *
 * Import reads `.rules` and `.zed/settings.json`.
 * Zed also reads `AGENTS.md`, `CLAUDE.md`, and `.cursorrules` as
 * fallbacks but we generate to the native `.rules` path.
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { generateRules } from './generator.js';
import { importFromZed } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions, lintIgnore } from './lint.js';
import { buildZedImportPaths } from '../../core/reference/import-map-builders.js';
import {
  ZED_TARGET,
  ZED_ROOT_FILE,
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
  ZED_CANONICAL_RULES_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: ZED_TARGET,
  primaryRootInstructionPath: ZED_ROOT_FILE,
  generateRules,
  importFrom: importFromZed,
};

const project: TargetLayout = {
  rootInstructionPath: ZED_ROOT_FILE,
  managedOutputs: {
    dirs: [],
    files: [ZED_ROOT_FILE, ZED_SETTINGS_FILE],
  },
  paths: {
    rulePath(_slug) {
      return ZED_ROOT_FILE;
    },
    commandPath() {
      return null;
    },
    agentPath() {
      return null;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: undefined,
  managedOutputs: {
    dirs: [],
    files: [ZED_GLOBAL_SETTINGS_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === ZED_SETTINGS_FILE) return ZED_GLOBAL_SETTINGS_FILE;
    return path;
  },
  paths: {
    rulePath() {
      return ZED_GLOBAL_SETTINGS_FILE;
    },
    commandPath() {
      return null;
    },
    agentPath() {
      return null;
    },
  },
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'none',
  agents: 'none',
  skills: 'none',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

const globalCapabilities: TargetCapabilities = {
  rules: 'none',
  additionalRules: 'none',
  commands: 'none',
  agents: 'none',
  skills: 'none',
  mcp: 'native',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};

function mergeZedSettings(existing: string | null, newContent: string): string {
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
  if (overlay['context_servers'] !== undefined) {
    base['context_servers'] = overlay['context_servers'];
  }
  return JSON.stringify(base, null, 2);
}

export const descriptor = {
  id: ZED_TARGET,
  generators: target,
  capabilities,
  emptyImportMessage: 'No Zed config found (.rules or .zed/settings.json).',
  lintRules,
  lint: {
    hooks: lintHooks,
    permissions: lintPermissions,
    ignore: lintIgnore,
  },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [ZED_GLOBAL_SETTINGS_FILE],
    layout: globalLayout,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'singleFile',
      source: {
        project: [ZED_ROOT_FILE],
        global: [],
      },
      canonicalDir: ZED_CANONICAL_RULES_DIR,
      canonicalRootFilename: '_root.md',
      markAsRoot: true,
    },
  },
  emitScopedSettings(canonical, _scope) {
    if (!canonical.mcp || Object.keys(canonical.mcp.mcpServers).length === 0) return [];
    const contextServers: Record<string, unknown> = {};
    for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
      contextServers[name] = server;
    }
    return [
      {
        path: ZED_SETTINGS_FILE,
        content: JSON.stringify({ context_servers: contextServers }, null, 2),
      },
    ];
  },
  mergeGeneratedOutputContent(existing, _pending, newContent, resolvedPath) {
    if (resolvedPath === ZED_SETTINGS_FILE || resolvedPath === ZED_GLOBAL_SETTINGS_FILE) {
      return mergeZedSettings(existing, newContent);
    }
    return null;
  },
  buildImportPaths: buildZedImportPaths,
  detectionPaths: [ZED_ROOT_FILE, ZED_SETTINGS_FILE],
} satisfies TargetDescriptor;
