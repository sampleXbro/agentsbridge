import { join } from 'node:path';
import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import type { GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { CONTINUE_GLOBAL_AGENTS_MD } from './constants.js';
import { generateContinueGlobalConfig } from './global-config.js';

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

/**
 * Emits ~/.continue/AGENTS.md (root rule compat mirror) and ~/.continue/config.yaml.
 */
export const generateContinueScopeExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  const configResults = await generateContinueGlobalConfig(
    canonical,
    projectRoot,
    scope,
    enabledFeatures,
  );

  if (scope !== 'global' || !enabledFeatures.has('rules')) return configResults;
  const root = canonical.rules.find((r) => r.root);
  if (!root) return configResults;

  const content = root.body.trim();
  const existing = await readFileSafe(join(projectRoot, CONTINUE_GLOBAL_AGENTS_MD));
  return [
    ...configResults,
    {
      target: 'continue',
      path: CONTINUE_GLOBAL_AGENTS_MD,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    },
  ];
};
