import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateHooks,
} from './generator.js';
import { CLINE_AGENTS_MD, CLINE_RULES_DIR, CLINE_WORKFLOWS_DIR } from './constants.js';
import { importFromCline } from './importer.js';
import { lintRules } from './linter.js';
import { buildClineImportPaths } from '../../core/reference/import-map-builders.js';
import { shouldConvertAgentsToSkills } from '../../config/core/conversions.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';

export const target: TargetGenerators = {
  name: 'cline',
  primaryRootInstructionPath: CLINE_AGENTS_MD,
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromCline,
};

export const descriptor = {
  id: 'cline',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'native',
    agents: 'embedded',
    skills: 'native',
    mcp: 'native',
    hooks: 'none',
    ignore: 'native',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Cline config found (.clinerules, .clineignore, .cline/cline_mcp_settings.json, or .cline/skills).',
  lintRules,
  skillDir: '.cline/skills',
  paths: {
    rulePath(slug, _rule) {
      return `${CLINE_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${CLINE_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'cline')
        ? `.cline/skills/${projectedAgentSkillDirName(name)}/SKILL.md`
        : null;
    },
  },
  buildImportPaths: buildClineImportPaths,
  detectionPaths: ['.clinerules', '.cline'],
} satisfies TargetDescriptor;
