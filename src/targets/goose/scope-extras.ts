/**
 * Global-scope extras for Goose: emits `~/.config/goose/permission.yaml` from
 * canonical permissions. Goose only reads tool permissions at the global tier,
 * so this is gated to global scope (the descriptor schema accepts scopeExtras
 * as the implementation for a global-only settings-backed capability).
 */

import { join } from 'node:path';
import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import type { GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { GOOSE_GLOBAL_PERMISSIONS } from './constants.js';
import { serializeGoosePermissions } from './permissions.js';

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

export const generateGooseScopeExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global' || !enabledFeatures.has('permissions')) return [];
  const existing = await readFileSafe(join(projectRoot, GOOSE_GLOBAL_PERMISSIONS));
  const content = serializeGoosePermissions(canonical.permissions, existing);
  if (!content) return [];
  return [
    {
      target: 'goose',
      path: GOOSE_GLOBAL_PERMISSIONS,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    },
  ];
};
