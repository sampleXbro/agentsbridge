import { addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  AMP_ROOT_FILE,
  AMP_SKILLS_DIR,
  AMP_MCP_FILE,
  AMP_GLOBAL_ROOT_FILE,
  AMP_GLOBAL_SKILLS_DIR,
  AMP_GLOBAL_MCP_FILE,
} from '../../../targets/amp/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES } from './constants.js';

export async function buildAmpImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(AMP_GLOBAL_ROOT_FILE, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, AMP_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), AMP_GLOBAL_SKILLS_DIR);
    }
    refs.set(AMP_GLOBAL_MCP_FILE, '.agentsmesh/mcp.json');
    return;
  }

  refs.set(AMP_ROOT_FILE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, AMP_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), AMP_SKILLS_DIR);
  }
  refs.set(AMP_MCP_FILE, '.agentsmesh/mcp.json');
}
