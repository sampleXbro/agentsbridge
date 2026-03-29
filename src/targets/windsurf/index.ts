import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateIgnore,
  generateMcp,
  generateHooks,
} from './generator.js';
import { WINDSURF_AGENTS_MD, WINDSURF_RULES_DIR, WINDSURF_WORKFLOWS_DIR } from './constants.js';
import { importFromWindsurf } from './importer.js';
import { lintRules } from './linter.js';
import { buildWindsurfImportPaths } from '../../core/reference/import-map-builders.js';
import { shouldConvertAgentsToSkills } from '../../config/core/conversions.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';

export const target: TargetGenerators = {
  name: 'windsurf',
  primaryRootInstructionPath: WINDSURF_AGENTS_MD,
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromWindsurf,
};

export const descriptor = {
  id: 'windsurf',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'native',
    agents: 'embedded',
    skills: 'native',
    mcp: 'partial',
    hooks: 'native',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Windsurf config found (.windsurfrules, .windsurf/rules, .windsurfignore, or .codeiumignore).',
  lintRules,
  skillDir: '.windsurf/skills',
  paths: {
    rulePath(slug, _rule) {
      return `${WINDSURF_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${WINDSURF_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'windsurf')
        ? `.windsurf/skills/${projectedAgentSkillDirName(name)}/SKILL.md`
        : null;
    },
  },
  buildImportPaths: buildWindsurfImportPaths,
  detectionPaths: ['.windsurfrules', '.windsurf'],
} satisfies TargetDescriptor;
