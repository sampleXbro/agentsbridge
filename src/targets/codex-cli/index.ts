import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
} from './generator.js';
import { AGENTS_MD, CODEX_SKILLS_DIR, CODEX_AGENTS_DIR } from './constants.js';
import { importFromCodex } from './importer.js';
import { lintRules } from './linter.js';
import { buildCodexCliImportPaths } from '../../core/reference/import-map-builders.js';
import { shouldConvertCommandsToSkills } from '../../config/core/conversions.js';
import { codexAdvisoryInstructionPath } from './codex-rule-paths.js';
import { commandSkillDirName } from './command-skill.js';

export const target: TargetGenerators = {
  name: 'codex-cli',
  primaryRootInstructionPath: AGENTS_MD,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  importFrom: importFromCodex,
};

export const descriptor = {
  id: 'codex-cli',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'embedded',
    agents: 'native',
    skills: 'native',
    mcp: 'native',
    hooks: 'none',
    ignore: 'none',
    permissions: 'none',
  },
  emptyImportMessage: 'No Codex config found (codex.md or AGENTS.md).',
  lintRules,
  skillDir: '.agents/skills',
  paths: {
    rulePath(_slug, rule) {
      return codexAdvisoryInstructionPath(rule);
    },
    commandPath(name, config: ValidatedConfig) {
      return shouldConvertCommandsToSkills(config, 'codex-cli')
        ? `${CODEX_SKILLS_DIR}/${commandSkillDirName(name)}/SKILL.md`
        : null;
    },
    agentPath(name, _config) {
      return `${CODEX_AGENTS_DIR}/${name}.toml`;
    },
  },
  buildImportPaths: buildCodexCliImportPaths,
  detectionPaths: ['codex.md'],
} satisfies TargetDescriptor;
