import { addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  ROVODEV_ROOT_FILE,
  ROVODEV_SKILLS_DIR,
  ROVODEV_MCP_FILE,
  ROVODEV_GLOBAL_ROOT_FILE,
  ROVODEV_GLOBAL_SKILLS_DIR,
  ROVODEV_GLOBAL_MCP_FILE,
} from '../../../targets/rovodev/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES } from './constants.js';

export async function buildRovodevImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(ROVODEV_GLOBAL_ROOT_FILE, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, ROVODEV_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), ROVODEV_GLOBAL_SKILLS_DIR);
    }
    refs.set(ROVODEV_GLOBAL_MCP_FILE, '.agentsmesh/mcp.json');
    return;
  }

  refs.set(ROVODEV_ROOT_FILE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, ROVODEV_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), ROVODEV_SKILLS_DIR);
  }
  refs.set(ROVODEV_MCP_FILE, '.agentsmesh/mcp.json');
}
