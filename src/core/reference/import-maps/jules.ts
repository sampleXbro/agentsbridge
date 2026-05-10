import { JULES_ROOT_FILE } from '../../../targets/jules/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES } from './constants.js';

export async function buildJulesImportPaths(
  refs: Map<string, string>,
  _projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  // Jules has no global config — cloud-based agent
  if (scope === 'global') return;

  refs.set(JULES_ROOT_FILE, `${AB_RULES}/_root.md`);
}
