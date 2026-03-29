import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor } from '../catalog/target-descriptor.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateHooks,
} from './generator.js';
import { COPILOT_INSTRUCTIONS, COPILOT_INSTRUCTIONS_DIR, COPILOT_AGENTS_DIR } from './constants.js';
import { importFromCopilot } from './importer.js';
import { lintRules } from './linter.js';
import { buildCopilotImportPaths } from '../../core/reference/import-map-builders.js';
import { commandPromptPath } from './command-prompt.js';

export const target: TargetGenerators = {
  name: 'copilot',
  primaryRootInstructionPath: COPILOT_INSTRUCTIONS,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateHooks,
  importFrom: importFromCopilot,
};

export const descriptor = {
  id: 'copilot',
  generators: target,
  capabilities: {
    rules: 'native',
    commands: 'native',
    agents: 'native',
    skills: 'native',
    mcp: 'none',
    hooks: 'partial',
    ignore: 'none',
    permissions: 'none',
  },
  emptyImportMessage:
    'No Copilot config found (.github/copilot-instructions.md, .github/copilot or .github/instructions, .github/prompts, .github/skills, .github/agents, or .github/hooks).',
  lintRules,
  skillDir: '.github/skills',
  paths: {
    rulePath(slug, _rule) {
      return `${COPILOT_INSTRUCTIONS_DIR}/${slug}.instructions.md`;
    },
    commandPath(name, _config) {
      return commandPromptPath(name);
    },
    agentPath(name, _config) {
      return `${COPILOT_AGENTS_DIR}/${name}.agent.md`;
    },
  },
  buildImportPaths: buildCopilotImportPaths,
  detectionPaths: [
    '.github/copilot-instructions.md',
    '.github/copilot',
    '.github/instructions',
    '.github/prompts',
    '.github/skills',
    '.github/agents',
    '.github/hooks',
  ],
} satisfies TargetDescriptor;
