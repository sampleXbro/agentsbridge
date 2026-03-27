import type { TargetGenerators } from '../catalog/target.interface.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
} from './generator.js';
import { AGENTS_MD } from './constants.js';
import { importFromCodex } from './importer.js';

export const target: TargetGenerators = {
  name: 'codex-cli',
  primaryRootInstructionPath: AGENTS_MD,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  importFrom: importFromCodex,
};
