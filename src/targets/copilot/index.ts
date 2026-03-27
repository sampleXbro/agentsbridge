import type { TargetGenerators } from '../catalog/target.interface.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateHooks,
} from './generator.js';
import { COPILOT_INSTRUCTIONS } from './constants.js';
import { importFromCopilot } from './importer.js';

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
