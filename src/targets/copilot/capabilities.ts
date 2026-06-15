/**
 * Copilot capability projections.
 *
 * Exported as named constants (`projectCapabilities`, `globalCapabilities`) to
 * avoid name shadowing with any inline variables in `index.ts`.
 */

import type { TargetCapabilities } from '../catalog/target.interface.js';

export const projectCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'partial',
  ignore: 'none',
  permissions: 'none',
};

export const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'none',
  hooks: 'none',
  ignore: 'none',
  permissions: 'none',
};
