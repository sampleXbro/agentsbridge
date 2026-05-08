/**
 * Index/descriptor template — the largest piece of scaffold output, kept
 * in its own file so the templates barrel stays under the 200-line budget.
 */
import { toPascal, toPrefix, type TemplateVars } from './templates-shared.js';

export function TEMPLATE_INDEX(v: TemplateVars): string {
  const p = toPrefix(v.id);
  const pascal = toPascal(v.id);
  return `import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { generateRules } from './generator.js';
import { importFrom${pascal} } from './importer.js';
import { lintRules } from './linter.js';
import { lintHooks } from './lint.js';
import { build${pascal}ImportPaths } from '../../core/reference/import-map-builders.js';
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
  supportsConversion: { commands: true, agents: true },
  lint: {
    hooks: lintHooks,
  },
  emptyImportMessage:
    'No ${v.displayName} config found (${p}_DIR).',
  lintRules,
  project,
  globalSupport: {
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
    detectionPaths: [${p}_GLOBAL_DIR],
    layout: global,
  },
  buildImportPaths: build${pascal}ImportPaths,
  detectionPaths: [${p}_DIR],
} satisfies TargetDescriptor;
`;
}
