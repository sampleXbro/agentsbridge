import { addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  AIDER_CONVENTIONS,
  AIDER_SKILLS_DIR,
  AIDER_IGNORE,
  AIDER_GLOBAL_CONVENTIONS,
  AIDER_GLOBAL_SKILLS_DIR,
  AIDER_GLOBAL_IGNORE,
} from '../../../targets/aider/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES } from './constants.js';

export async function buildAiderImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(AIDER_GLOBAL_CONVENTIONS, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, AIDER_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), AIDER_GLOBAL_SKILLS_DIR);
    }
    refs.set(AIDER_GLOBAL_IGNORE, '.agentsmesh/ignore');
    return;
  }

  refs.set(AIDER_CONVENTIONS, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, AIDER_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), AIDER_SKILLS_DIR);
  }
  refs.set(AIDER_IGNORE, '.agentsmesh/ignore');
}
