import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import {
  ZED_ROOT_FILE,
  ZED_SETTINGS_FILE,
  ZED_SKILLS_DIR,
  ZED_GLOBAL_ROOT_FILE,
  ZED_GLOBAL_SKILLS_DIR,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../targets/zed/constants.js';
import { addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import { AB_RULES } from './constants.js';

export async function buildZedImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(ZED_GLOBAL_ROOT_FILE, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, ZED_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), ZED_GLOBAL_SKILLS_DIR);
    }
    refs.set(ZED_GLOBAL_SETTINGS_FILE, '.agentsmesh/mcp.json');
    return;
  }

  refs.set(ZED_ROOT_FILE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, ZED_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), ZED_SKILLS_DIR);
  }
  refs.set(ZED_SETTINGS_FILE, '.agentsmesh/mcp.json');
}
