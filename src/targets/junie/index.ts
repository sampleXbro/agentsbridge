import { registerTarget } from '../registry.js';
import type { TargetGenerators } from '../target.interface.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
} from './generator.js';
import { importFromJunie } from './importer.js';

const target: TargetGenerators = {
  name: 'junie',
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  importFrom: importFromJunie,
};

registerTarget(target);
