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
import { CLAUDE_ROOT } from './constants.js';
import { importFromClaudeCode } from './importer.js';

const target: TargetGenerators = {
  name: 'claude-code',
  primaryRootInstructionPath: CLAUDE_ROOT,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generatePermissions,
  generateHooks,
  generateIgnore,
  importFrom: importFromClaudeCode,
};

registerTarget(target);
