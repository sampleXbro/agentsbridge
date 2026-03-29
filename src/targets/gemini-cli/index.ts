import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateSettings,
  generateIgnore,
} from './generator.js';
import { generateGeminiPermissionsPolicies } from './policies-generator.js';
import { GEMINI_ROOT, GEMINI_COMMANDS_DIR, GEMINI_AGENTS_DIR } from './constants.js';
import { importFromGemini } from './importer.js';
import { lintRules } from './linter.js';
import { buildGeminiCliImportPaths } from '../../core/reference/import-map-builders.js';
import { shouldConvertAgentsToSkills } from '../../config/core/conversions.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';

export const target: TargetGenerators = {
  name: 'gemini-cli',
  primaryRootInstructionPath: GEMINI_ROOT,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateSettings,
  generateIgnore,
  generatePermissions: generateGeminiPermissionsPolicies,
  importFrom: importFromGemini,
};

export const descriptor = {
  id: 'gemini-cli',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'native',
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'partial',
    ignore: 'native',
    permissions: 'partial',
  },
  emptyImportMessage:
    'No Gemini CLI config found (GEMINI.md or .gemini/rules, .gemini/commands, .gemini/settings.json).',
  lintRules,
  skillDir: '.gemini/skills',
  paths: {
    rulePath(_slug, _rule) {
      return GEMINI_ROOT;
    },
    commandPath(name, _config) {
      if (name.includes(':')) {
        const parts = name.split(':').filter(Boolean);
        const fileBase = parts.pop() ?? name;
        const dirs = parts;
        return `${GEMINI_COMMANDS_DIR}/${dirs.join('/')}/${fileBase}.toml`;
      }
      return `${GEMINI_COMMANDS_DIR}/${name}.toml`;
    },
    agentPath(name, config: ValidatedConfig) {
      return shouldConvertAgentsToSkills(config, 'gemini-cli')
        ? `.gemini/skills/${projectedAgentSkillDirName(name)}/SKILL.md`
        : `${GEMINI_AGENTS_DIR}/${name}.md`;
    },
  },
  buildImportPaths: buildGeminiCliImportPaths,
  detectionPaths: ['GEMINI.md', '.gemini'],
} satisfies TargetDescriptor;
