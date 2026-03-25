import { registerTarget } from '../registry.js';
import type { TargetGenerators } from '../target.interface.js';
import { generateRules, generateCommands, generateSkills, generateMcp } from './generator.js';
import { importFromContinue } from './importer.js';

const target: TargetGenerators = {
  name: 'continue',
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  importFrom: importFromContinue,
};

registerTarget(target);
