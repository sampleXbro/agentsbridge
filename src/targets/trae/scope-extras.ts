/**
 * `globalSupport.scopeExtras` for Trae.
 *
 * `~/.trae/permission/global.json` is global-only — Trae documents no
 * project-tier permission file — so the scope gate lives here once and the
 * emitter cannot leak into project scope.
 */

import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import { generateTraeGlobalPermissions } from './global-permissions.js';

export const traeScopeExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global') return [];
  return generateTraeGlobalPermissions(canonical, projectRoot, enabledFeatures);
};
