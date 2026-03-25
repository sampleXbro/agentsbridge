import { registerTarget } from '../registry.js';
import type { TargetGenerators } from '../target.interface.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateSettings,
  generateIgnore,
} from './generator.js';
import { generateGeminiPermissionsPolicies } from './policies-generator.js';
import { importFromGemini } from './importer.js';

const target: TargetGenerators = {
  name: 'gemini-cli',
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateSettings,
  generateIgnore,
  generatePermissions: generateGeminiPermissionsPolicies,
  importFrom: importFromGemini,
};

registerTarget(target);
