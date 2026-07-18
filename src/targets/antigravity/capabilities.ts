import type { TargetCapabilities } from '../catalog/target.interface.js';
import { cap } from '../catalog/capabilities.js';

export const projectCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: cap('native', 'workflows'),
  agents: 'none',
  skills: 'native',
  mcp: 'none',
  hooks: 'native',
  ignore: 'none',
  permissions: 'partial',
};

export const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: cap('native', 'workflows'),
  agents: 'none',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'none',
  permissions: 'partial',
};
