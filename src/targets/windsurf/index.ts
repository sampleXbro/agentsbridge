import type { TargetGenerators } from '../catalog/target.interface.js';
import {
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateIgnore,
  generateMcp,
  generateHooks,
} from './generator.js';
import { WINDSURF_AGENTS_MD } from './constants.js';
import { importFromWindsurf } from './importer.js';

export const target: TargetGenerators = {
  name: 'windsurf',
  primaryRootInstructionPath: WINDSURF_AGENTS_MD,
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
  importFrom: importFromWindsurf,
};
