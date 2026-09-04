/**
 * `globalSupport.scopeExtras` for Warp.
 *
 * `~/.warp/settings.toml` is global-only — Warp documents no project-tier
 * settings file — so the scope gate lives here once and the emitter cannot
 * leak into project scope.
 */

import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import { generateWarpGlobalPermissions } from './global-permissions.js';

export const warpScopeExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global') return [];
  return generateWarpGlobalPermissions(canonical, projectRoot, enabledFeatures);
};
