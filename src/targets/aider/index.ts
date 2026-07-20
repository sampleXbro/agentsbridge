/**
 * Aider target descriptor.
 *
 * Generation emits:
 *   - `CONVENTIONS.md`    — root rule + embedded additional rules
 *   - `.aider.conf.yml`   — wires CONVENTIONS.md via `read:` (project scope only)
 *   - `.aider/skills/`    — skill bundles
 *   - `.aiderignore`      — ignore patterns
 *
 * Import reads `CONVENTIONS.md`, `.aider/skills/`, and `.aiderignore`. The
 * `.aider.conf.yml` is deterministic wiring (not imported as canonical content).
 */

import type { TargetCapabilities, TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { commandSkillDirName } from '../codex-cli/command-skill.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateIgnore,
  generateMcp,
  generateHooks,
  generatePermissions,
} from './generator.js';
import { importFromAider } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks, lintPermissions, lintMcp } from './lint.js';
import { buildAiderImportPaths } from '../../core/reference/import-map-builders.js';
import {
  AIDER_TARGET,
  AIDER_CONVENTIONS,
  AIDER_CONF_FILE,
  AIDER_SKILLS_DIR,
  AIDER_IGNORE,
  AIDER_GLOBAL_CONVENTIONS,
  AIDER_GLOBAL_SKILLS_DIR,
  AIDER_GLOBAL_IGNORE,
  AIDER_CANONICAL_RULES_DIR,
  AIDER_CANONICAL_IGNORE,
} from './constants.js';

/**
 * Merge the generated `.aider.conf.yml` (which carries `read: [CONVENTIONS.md]`)
 * into an existing user config: preserve every other key and union the `read`
 * list so the conventions wiring is added without clobbering user settings.
 */
function mergeAiderConf(existing: string | null, newContent: string): string {
  if (existing === null) return newContent;
  let parsed: unknown;
  try {
    parsed = parseYaml(existing);
  } catch {
    return newContent;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return newContent;
  const base = parsed as Record<string, unknown>;
  const reads = new Set<string>();
  const existingRead = base.read;
  if (typeof existingRead === 'string') reads.add(existingRead);
  else if (Array.isArray(existingRead)) {
    for (const entry of existingRead) if (typeof entry === 'string') reads.add(entry);
  }
  reads.add(AIDER_CONVENTIONS);
  base.read = [...reads];
  return stringifyYaml(base);
}

export const target: TargetGenerators = {
  name: AIDER_TARGET,
  primaryRootInstructionPath: AIDER_CONVENTIONS,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateIgnore,
  generateMcp,
  generateHooks,
  generatePermissions,
  importFrom: importFromAider,
};

const project: TargetLayout = {
  rootInstructionPath: AIDER_CONVENTIONS,
  skillDir: AIDER_SKILLS_DIR,
  managedOutputs: {
    dirs: [AIDER_SKILLS_DIR],
    files: [AIDER_CONVENTIONS, AIDER_CONF_FILE, AIDER_IGNORE],
  },
  paths: {
    rulePath(_slug) {
      return AIDER_CONVENTIONS;
    },
    commandPath(name) {
      return `${AIDER_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${AIDER_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: AIDER_GLOBAL_CONVENTIONS,
  skillDir: AIDER_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [AIDER_GLOBAL_SKILLS_DIR],
    files: [AIDER_GLOBAL_CONVENTIONS, AIDER_GLOBAL_IGNORE],
  },
  rewriteGeneratedPath(path) {
    if (path === AIDER_CONVENTIONS) return AIDER_GLOBAL_CONVENTIONS;
    if (path === AIDER_IGNORE) return AIDER_GLOBAL_IGNORE;
    // The `.aider.conf.yml read:` wiring is project-only — a home-level config's
    // `read:` path semantics differ, so suppress it in global mode.
    if (path === AIDER_CONF_FILE) return null;
    if (path.startsWith(`${AIDER_SKILLS_DIR}/`)) {
      return path.replace(`${AIDER_SKILLS_DIR}/`, `${AIDER_GLOBAL_SKILLS_DIR}/`);
    }
    return path;
  },
  paths: {
    rulePath(_slug) {
      return AIDER_GLOBAL_CONVENTIONS;
    },
    commandPath(name) {
      return `${AIDER_GLOBAL_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`;
    },
    agentPath(name) {
      return `${AIDER_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const capabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: 'none',
  agents: 'none',
  skills: 'native',
  mcp: 'partial',
  hooks: 'partial',
  ignore: 'native',
  permissions: 'partial',
};

export const descriptor = {
  id: AIDER_TARGET,
  metadata: {
    displayName: 'Aider',
    category: 'cli',
    officialUrl: 'https://aider.chat',
    shortDescription: 'Open-source terminal AI pair programmer',
  },
  generators: target,
  capabilities,
  emptyImportMessage: 'No Aider config found (CONVENTIONS.md, .aider/skills, or .aiderignore).',
  lintRules,
  lint: {
    hooks: lintHooks,
    permissions: lintPermissions,
    mcp: lintMcp,
  },
  supportsConversion: { commands: true, agents: true },
  project,
  globalSupport: {
    capabilities,
    detectionPaths: [AIDER_GLOBAL_CONVENTIONS, AIDER_GLOBAL_IGNORE, AIDER_GLOBAL_SKILLS_DIR],
    layout: globalLayout,
  },
  importer: {
    rules: {
      feature: 'rules',
      mode: 'singleFile',
      source: {
        project: [AIDER_CONVENTIONS],
        global: [AIDER_GLOBAL_CONVENTIONS],
      },
      canonicalDir: AIDER_CANONICAL_RULES_DIR,
      canonicalRootFilename: '_root.md',
      markAsRoot: true,
    },
    ignore: {
      feature: 'ignore',
      mode: 'flatFile',
      source: {
        project: [AIDER_IGNORE],
        global: [AIDER_GLOBAL_IGNORE],
      },
      canonicalDir: '.agentsmesh',
      canonicalFilename: AIDER_CANONICAL_IGNORE,
    },
  },
  mergeGeneratedOutputContent(existing, _pending, newContent, resolvedPath) {
    if (resolvedPath === AIDER_CONF_FILE) return mergeAiderConf(existing, newContent);
    return null;
  },
  buildImportPaths: buildAiderImportPaths,
  detectionPaths: [AIDER_CONVENTIONS, AIDER_IGNORE],
} satisfies TargetDescriptor;
