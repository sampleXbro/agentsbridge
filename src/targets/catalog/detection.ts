import type { ConfigScope } from '../../config/core/scope.js';
import { BUILTIN_TARGETS, getTargetDetectionPaths } from './builtin-targets.js';

/**
 * Single producer for init/doctor: all detection paths per scope.
 */
export function collectDetectionPaths(scope: ConfigScope): { target: string; path: string }[] {
  const out: { target: string; path: string }[] = [];
  for (const d of BUILTIN_TARGETS) {
    for (const path of getTargetDetectionPaths(d.id, scope)) {
      out.push({ target: d.id, path });
    }
  }
  return out;
}
