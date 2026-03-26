import { registerTarget } from '../registry.js';
import type { TargetGenerators } from '../target.interface.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
} from './generator.js';
import { AGENTS_MD } from './constants.js';
import { importFromCodex } from './importer.js';

const target: TargetGenerators = {
  name: 'codex-cli',
  primaryRootInstructionPath: AGENTS_MD,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  importFrom: importFromCodex,
};

registerTarget(target);
