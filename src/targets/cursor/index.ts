import { registerTarget } from '../registry.js';
import type { TargetGenerators } from '../target.interface.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generatePermissions,
  generateHooks,
  generateIgnore,
} from './generator.js';
import { importFromCursor } from './importer.js';

const target: TargetGenerators = {
  name: 'cursor',
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generatePermissions,
  generateHooks,
  generateIgnore,
  importFrom: importFromCursor,
};

registerTarget(target);
