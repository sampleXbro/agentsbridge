import type { TargetCapabilities } from '../catalog/target.interface.js';

export const projectCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'none',
  mcp: 'native',
  hooks: 'embedded',
  ignore: 'none',
  permissions: 'embedded',
};

export const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'none',
  commands: 'native',
  agents: 'native',
  skills: 'none',
  mcp: 'native',
  hooks: 'embedded',
  ignore: 'none',
  permissions: 'embedded',
};
