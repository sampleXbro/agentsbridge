/**
 * `globalSupport.scopeExtras` for Deep Agents CLI.
 *
 * Both extra surfaces are global-only — `~/.deepagents/hooks.json` and
 * `~/.deepagents/config.toml` have no project-tier equivalent — so the scope
 * gate lives here once, and neither emitter can leak into project scope.
 */

import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import { generateDeepagentsCliGlobalHooks } from './global-hooks.js';
import { generateDeepagentsCliGlobalPermissions } from './global-permissions.js';

export const deepagentsCliScopeExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global') return [];
  return [
    ...(await generateDeepagentsCliGlobalHooks(canonical, projectRoot, enabledFeatures)),
    ...(await generateDeepagentsCliGlobalPermissions(canonical, projectRoot, enabledFeatures)),
  ];
};
