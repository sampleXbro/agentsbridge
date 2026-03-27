import type { TargetGenerators } from '../catalog/target.interface.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
} from './generator.js';
import { JUNIE_DOT_AGENTS } from './constants.js';
import { importFromJunie } from './importer.js';

export const target: TargetGenerators = {
  name: 'junie',
  primaryRootInstructionPath: JUNIE_DOT_AGENTS,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  importFrom: importFromJunie,
};
