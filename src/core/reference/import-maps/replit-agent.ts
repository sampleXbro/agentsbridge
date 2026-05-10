import { addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  REPLIT_AGENT_ROOT_FILE,
  REPLIT_AGENT_SKILLS_DIR,
} from '../../../targets/replit-agent/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES } from './constants.js';

export async function buildReplitAgentImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    // Replit Agent is cloud-only; no global config paths
    return;
  }

  refs.set(REPLIT_AGENT_ROOT_FILE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, REPLIT_AGENT_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), REPLIT_AGENT_SKILLS_DIR);
  }
}
