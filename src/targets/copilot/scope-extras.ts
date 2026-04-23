import { join } from 'node:path';
import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import type { GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { COPILOT_GLOBAL_AGENTS_MD } from './constants.js';

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

/**
 * Emits ~/.copilot/AGENTS.md from root rule body in global scope.
 * Used as AGENTS.md compat mirror so other tools reading AGENTS.md see the rules.
 */
export const generateCopilotGlobalExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global' || !enabledFeatures.has('rules')) return [];
  const root = canonical.rules.find((r) => r.root);
  if (!root) return [];
  const content = root.body.trim();
  const existing = await readFileSafe(join(projectRoot, COPILOT_GLOBAL_AGENTS_MD));
  return [
    {
      target: 'copilot',
      path: COPILOT_GLOBAL_AGENTS_MD,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    },
  ];
};
