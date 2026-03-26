import { registerTarget } from '../registry.js';
import type { TargetGenerators } from '../target.interface.js';
import { generateRules, generateCommands, generateSkills, generateMcp } from './generator.js';
import { CONTINUE_ROOT_RULE } from './constants.js';
import { importFromContinue } from './importer.js';

const target: TargetGenerators = {
  name: 'continue',
  primaryRootInstructionPath: CONTINUE_ROOT_RULE,
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
  importFrom: importFromContinue,
};

registerTarget(target);
