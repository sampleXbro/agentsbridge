import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import {
  ZED_ROOT_FILE,
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../targets/zed/constants.js';
import { AB_RULES } from './constants.js';

export async function buildZedImportPaths(
  refs: Map<string, string>,
  _projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(ZED_GLOBAL_SETTINGS_FILE, '.agentsmesh/mcp.json');
    return;
  }

  refs.set(ZED_ROOT_FILE, `${AB_RULES}/_root.md`);
  refs.set(ZED_SETTINGS_FILE, '.agentsmesh/mcp.json');
}
