import type { TargetCapabilities } from '../catalog/target.interface.js';
import { cap } from '../catalog/capabilities.js';

/**
 * `permissions` stays `partial` for the project: Antigravity keeps per-project
 * permission state outside the repo in `~/.gemini/config/projects/<uuid>/`, so
 * there is nothing repo-writable to generate. `ignore` is project-only — no
 * home-directory ignore file is documented.
 */
export const projectCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'native',
  commands: cap('native', 'workflows'),
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'native',
  permissions: 'partial',
};

export const globalCapabilities: TargetCapabilities = {
  rules: 'native',
  additionalRules: 'embedded',
  commands: cap('native', 'workflows'),
  agents: 'native',
  skills: 'native',
  mcp: 'native',
  hooks: 'native',
  ignore: 'none',
  permissions: 'native',
};
