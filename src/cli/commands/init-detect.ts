/**
 * Detection helpers for agentsmesh init command.
 */

import { join } from 'node:path';
import { exists } from '../../utils/filesystem/fs.js';
import { BUILTIN_TARGETS, getTargetDetectionPaths } from '../../targets/catalog/builtin-targets.js';
import type { ConfigScope } from '../../config/core/scope.js';

/** AI tool indicators for detection — derived from target descriptors. */
export const TOOL_INDICATORS: Array<{ id: string; paths: string[] }> = BUILTIN_TARGETS.map((d) => ({
  id: d.id,
  paths: [...d.detectionPaths],
}));

function toolIndicators(scope: ConfigScope): Array<{ id: string; paths: string[] }> {
  return BUILTIN_TARGETS.map((target) => ({
    id: target.id,
    paths: [...getTargetDetectionPaths(target.id, scope)],
  })).filter((indicator) => indicator.paths.length > 0);
}

/**
 * Detect existing AI tool configs in the project.
 * @param projectRoot - Project root directory
 * @returns Array of tool IDs that have configs
 */
export async function detectExistingConfigs(
  projectRoot: string,
  scope: ConfigScope = 'project',
): Promise<string[]> {
  const found: string[] = [];
  for (const { id, paths } of toolIndicators(scope)) {
    for (const p of paths) {
      const full = join(projectRoot, p);
      if (await exists(full)) {
        found.push(id);
        break;
      }
    }
  }
  return [...new Set(found)];
}
