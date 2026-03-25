import { registerTarget } from '../registry.js';
import type { TargetGenerators } from '../target.interface.js';
import {
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateHooks,
} from './generator.js';
import { importFromCline } from './importer.js';

const target: TargetGenerators = {
  name: 'cline',
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromCline,
};

registerTarget(target);
