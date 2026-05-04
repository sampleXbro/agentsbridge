import { addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  WARP_ROOT_FILE,
  WARP_SKILLS_DIR,
  WARP_MCP_FILE,
  WARP_GLOBAL_SKILLS_DIR,
} from '../../../targets/warp/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES } from './constants.js';

export async function buildWarpImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    for (const absPath of await listFiles(projectRoot, WARP_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), WARP_GLOBAL_SKILLS_DIR);
    }
    return;
  }

  refs.set(WARP_ROOT_FILE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, WARP_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), WARP_SKILLS_DIR);
  }
  refs.set(WARP_MCP_FILE, '.agentsmesh/mcp.json');
}
