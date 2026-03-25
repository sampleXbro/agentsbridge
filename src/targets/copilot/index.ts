import { registerTarget } from '../registry.js';
import type { TargetGenerators } from '../target.interface.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateHooks,
} from './generator.js';
import { importFromCopilot } from './importer.js';

const target: TargetGenerators = {
  name: 'copilot',
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateHooks,
  importFrom: importFromCopilot,
};

registerTarget(target);
