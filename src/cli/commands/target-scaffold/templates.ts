/**
 * Template functions for agentsmesh target scaffold command.
 * Each function returns a string of TypeScript source code.
 * Pattern mirrors src/cli/commands/init-templates.ts (string constants, bundled by tsup).
 */

export interface TemplateVars {
  id: string; // e.g. 'kilo-code'
  displayName: string; // e.g. 'Kilo Code'
}

/** Convert 'kilo-code' → 'KILO_CODE' */
function toPrefix(id: string): string {
  return id.toUpperCase().replace(/-/g, '_');
}

/** Convert 'kilo-code' → 'KiloCode' (PascalCase) */
function toPascal(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ─── constants.ts ─────────────────────────────────────────────────────────────

export function TEMPLATE_CONSTANTS(v: TemplateVars): string {
  const p = toPrefix(v.id);
  return `export const ${p}_TARGET = '${v.id}';

// Project-level paths
export const ${p}_DIR = '.${v.id}';
export const ${p}_RULES_DIR = '.${v.id}/rules';

// Global-level paths
export const ${p}_GLOBAL_DIR = '~/.${v.id}';
export const ${p}_GLOBAL_RULES_DIR = '~/.${v.id}/rules';

// Canonical paths
export const ${p}_CANONICAL_ROOT_RULE = '.agentsmesh/rules/_root.md';
export const ${p}_CANONICAL_RULES_DIR = '.agentsmesh/rules';
`;
}

// ─── index.ts ─────────────────────────────────────────────────────────────────

export function TEMPLATE_INDEX(v: TemplateVars): string {
  const p = toPrefix(v.id);
  const pascal = toPascal(v.id);
  return `import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { generateRules } from './generator.js';
import { importFrom${pascal} } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks } from './lint.js';
import { build${pascal}ImportPaths } from '../../core/reference/import-maps/${v.id}.js';
import {
  ${p}_TARGET,
  ${p}_DIR,
  ${p}_GLOBAL_DIR,
} from './constants.js';

export const target: TargetGenerators = {
  name: ${p}_TARGET,
  generateRules,
  importFrom: importFrom${pascal},
};

const project: TargetLayout = {
  managedOutputs: {
    dirs: [${p}_DIR],
    files: [],
  },
  paths: {
    rulePath(slug, _rule) {
      return ${p}_DIR + '/' + slug + '.md';
    },
    commandPath(_name, _config) {
      return null;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
};

const global: TargetLayout = {
  paths: {
    rulePath(slug, _rule) {
      return ${p}_GLOBAL_DIR + '/' + slug + '.md';
    },
    commandPath(_name, _config) {
      return null;
    },
    agentPath(_name, _config) {
      return null;
    },
  },
  rewriteGeneratedPath(path: string) {
    if (path.startsWith(${p}_DIR + '/')) {
      return ${p}_GLOBAL_DIR + '/' + path.slice(${p}_DIR.length + 1);
    }
    return path;
  },
};

export const descriptor = {
  id: ${p}_TARGET,
  generators: target,
  capabilities: {
    rules: 'native',
    additionalRules: 'none',
    commands: 'none',
    agents: 'none',
    skills: 'none',
    mcp: 'none',
    hooks: 'none',
    ignore: 'none',
    permissions: 'none',
  },
  globalCapabilities: {
    rules: 'native',
    additionalRules: 'none',
    commands: 'none',
    agents: 'none',
    skills: 'none',
    mcp: 'none',
    hooks: 'none',
    ignore: 'none',
    permissions: 'none',
  },
  supportsConversion: { commands: true, agents: true },
  lint: {
    hooks: lintHooks,
  },
  emptyImportMessage:
    'No ${v.displayName} config found (${p}_DIR).',
  lintRules,
  project,
  global,
  globalDetectionPaths: [${p}_GLOBAL_DIR],
  buildImportPaths: build${pascal}ImportPaths,
  detectionPaths: [${p}_DIR],
} satisfies TargetDescriptor;
`;
}

// ─── generator.ts ─────────────────────────────────────────────────────────────

export function TEMPLATE_GENERATOR(v: TemplateVars): string {
  const p = toPrefix(v.id);
  return `import type { CanonicalFiles } from '../../core/types.js';
import { ${p}_TARGET, ${p}_DIR } from './constants.js';

export interface ${toPascal(v.id)}Output {
  path: string;
  content: string;
}

export function generateRules(_canonical: CanonicalFiles): ${toPascal(v.id)}Output[] {
  // TODO(agentsmesh-scaffold): implement generateRules for ${v.displayName}
  void ${p}_TARGET;
  void ${p}_DIR;
  return [];
}
`;
}

// ─── importer.ts ──────────────────────────────────────────────────────────────

export function TEMPLATE_IMPORTER(v: TemplateVars): string {
  const pascal = toPascal(v.id);
  const p = toPrefix(v.id);
  return `import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { ${p}_TARGET } from './constants.js';

export async function importFrom${pascal}(
  _projectRoot: string,
  _options?: { scope?: TargetLayoutScope },
): Promise<ImportResult[]> {
  // TODO(agentsmesh-scaffold): implement importFrom${pascal} for ${v.displayName}
  void ${p}_TARGET;
  return [];
}
`;
}

// ─── linter.ts ────────────────────────────────────────────────────────────────

export function TEMPLATE_LINTER(v: TemplateVars): string {
  const p = toPrefix(v.id);
  return `/** Lint rules for the ${v.id} target. */
import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/lint/validate-rules.js';
import { ${p}_TARGET } from './constants.js';

export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
  options?: { scope?: 'project' | 'global' },
): LintDiagnostic[] {
  return validateRules(canonical, projectRoot, projectFiles, {
    checkGlobMatches: options?.scope !== 'global',
  }).map((diagnostic) => ({
    ...diagnostic,
    target: ${p}_TARGET,
  }));
}
`;
}

// ─── lint.ts ──────────────────────────────────────────────────────────────────

export function TEMPLATE_LINT_HOOKS(v: TemplateVars): string {
  return `/**
 * ${v.displayName}-specific lint hooks.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';

export function lintHooks(_canonical: CanonicalFiles): LintDiagnostic[] {
  // TODO(agentsmesh-scaffold): implement target-specific hook validation for ${v.displayName}
  return [];
}
`;
}

// ─── import-maps/<id>.ts ──────────────────────────────────────────────────────

export function TEMPLATE_IMPORT_MAP(v: TemplateVars): string {
  const pascal = toPascal(v.id);
  const p = toPrefix(v.id);
  return `import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { ${p}_DIR } from '../../../targets/${v.id}/constants.js';

export async function build${pascal}ImportPaths(
  _refs: Map<string, string>,
  _projectRoot: string,
  _scope: TargetLayoutScope = 'project',
): Promise<void> {
  // TODO(agentsmesh-scaffold): implement import path mapping for ${v.displayName}
  // Reference: src/core/reference/import-maps/kiro.ts for a full example
  void ${p}_DIR;
}
`;
}

// ─── tests/unit/targets/<id>/generator.test.ts ───────────────────────────────

export function TEMPLATE_GENERATOR_TEST(v: TemplateVars): string {
  return `import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { generateRules } from '../../../../src/targets/${v.id}/generator.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('generateRules (${v.id})', () => {
  it('returns an array', () => {
    const result = generateRules(makeCanonical());
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array when no rules', () => {
    const result = generateRules(makeCanonical({ rules: [] }));
    expect(result).toHaveLength(0);
  });
});
`;
}

// ─── tests/unit/targets/<id>/importer.test.ts ────────────────────────────────

export function TEMPLATE_IMPORTER_TEST(v: TemplateVars): string {
  const pascal = toPascal(v.id);
  return `import { describe, it, expect } from 'vitest';
import { importFrom${pascal} } from '../../../../src/targets/${v.id}/importer.js';

describe('importFrom${pascal} (${v.id})', () => {
  it('returns an array', async () => {
    const result = await importFrom${pascal}('/tmp/stub-project');
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array by default', async () => {
    const result = await importFrom${pascal}('/tmp/stub-project', { scope: 'project' });
    expect(result).toHaveLength(0);
  });
});
`;
}

// ─── tests/e2e/fixtures/<id>-project/AGENTS.md ───────────────────────────────

export function TEMPLATE_FIXTURE_ROOT_MD(v: TemplateVars): string {
  return `# ${v.displayName} Workspace

Follow the ${v.displayName} configuration files and keep changes small.
`;
}
