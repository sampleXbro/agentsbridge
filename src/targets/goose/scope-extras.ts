/**
 * Global-scope extras for Goose. Both files live under `~/.config/goose/` and
 * both must merge into content agentsmesh does not own, which the plain feature
 * loop cannot do (it never reads the disk):
 *   - `permission.yaml` — canonical permissions into the `user` category,
 *   - `config.yaml`     — canonical MCP servers into the `extensions` key
 *     (see `global-mcp.ts`).
 * Goose reads neither at project scope, so both are gated to global.
 */

import { join } from 'node:path';
import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import type { GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { computeStatus } from '../../core/generate/feature-loop.js';
import { GOOSE_TARGET, GOOSE_GLOBAL_PERMISSIONS } from './constants.js';
import { serializeGoosePermissions } from './permissions.js';
import { generateGooseGlobalMcp } from './global-mcp.js';

async function generateGoosePermissionFile(
  canonical: Parameters<ScopeExtrasFn>[0],
  projectRoot: string,
  enabledFeatures: ReadonlySet<string>,
): Promise<GenerateResult[]> {
  if (!enabledFeatures.has('permissions')) return [];
  const existing = await readFileSafe(join(projectRoot, GOOSE_GLOBAL_PERMISSIONS));
  const content = serializeGoosePermissions(canonical.permissions, existing);
  if (!content) return [];
  return [
    {
      target: GOOSE_TARGET,
      path: GOOSE_GLOBAL_PERMISSIONS,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    },
  ];
}

export const generateGooseScopeExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global') return [];
  return [
    ...(await generateGoosePermissionFile(canonical, projectRoot, enabledFeatures)),
    ...(await generateGooseGlobalMcp(canonical, projectRoot, enabledFeatures)),
  ];
};
