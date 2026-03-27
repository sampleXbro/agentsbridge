import type { TargetGenerators } from '../catalog/target.interface.js';
import {
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateHooks,
} from './generator.js';
import { CLINE_AGENTS_MD } from './constants.js';
import { importFromCline } from './importer.js';

export const target: TargetGenerators = {
  name: 'cline',
  primaryRootInstructionPath: CLINE_AGENTS_MD,
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromCline,
};
