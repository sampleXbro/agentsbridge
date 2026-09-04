import type { TargetCapabilities } from '../catalog/target.interface.js';

export const projectCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'none',
  mcp: 'native',
  hooks: 'embedded',
  // No ignore file exists in Q CLI; patterns ride in agent JSON `toolsSettings`.
  ignore: 'embedded',
  permissions: 'embedded',
};

export const globalCapabilities: TargetCapabilities = {
  // Q CLI has no global rules path (paths.rs `mod global` has no rules constant);
  // `.aws/amazonq/rules/*.md` is only read through the agent JSON `resources` glob.
  rules: 'embedded',
  additionalRules: 'embedded',
  commands: 'native',
  agents: 'native',
  skills: 'none',
  mcp: 'native',
  hooks: 'embedded',
  ignore: 'embedded',
  permissions: 'embedded',
};
