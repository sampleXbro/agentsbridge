import { registerTarget } from '../registry.js';
import type { TargetGenerators } from '../target.interface.js';
import {
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateIgnore,
  generateMcp,
  generateHooks,
} from './generator.js';
import { importFromWindsurf } from './importer.js';

const target: TargetGenerators = {
  name: 'windsurf',
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromWindsurf,
};

registerTarget(target);
