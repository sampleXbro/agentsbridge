import type { TargetGenerators } from '../catalog/target.interface.js';
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
import { CURSOR_GENERAL_RULE } from './constants.js';
import { importFromCursor } from './importer.js';

export const target: TargetGenerators = {
  name: 'cursor',
  primaryRootInstructionPath: CURSOR_GENERAL_RULE,
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
