/**
 * Continue feature support per scope.
 *
 * Permissions stay project-`none`: Continue reads allow/ask/exclude only from
 * `~/.continue/permissions.yaml` and project-level permissions are explicitly
 * unimplemented upstream.
 */

import type { TargetCapabilities } from '../catalog/target.interface.js';

export const projectCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: 'native',
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'native',
  permissions: 'none',
};

export const globalCapabilities: TargetCapabilities = {
  ...projectCapabilities,
  permissions: 'native',
};
