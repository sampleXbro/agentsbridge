import { addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  GOOSE_ROOT_FILE,
  GOOSE_SKILLS_DIR,
  GOOSE_IGNORE,
  GOOSE_GLOBAL_ROOT_FILE,
  GOOSE_GLOBAL_SKILLS_DIR,
  GOOSE_GLOBAL_IGNORE,
} from '../../../targets/goose/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES } from './constants.js';

export async function buildGooseImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(GOOSE_GLOBAL_ROOT_FILE, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, GOOSE_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), GOOSE_GLOBAL_SKILLS_DIR);
    }
    refs.set(GOOSE_GLOBAL_IGNORE, '.agentsmesh/ignore');
    return;
  }

  refs.set(GOOSE_ROOT_FILE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, GOOSE_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), GOOSE_SKILLS_DIR);
  }
  refs.set(GOOSE_IGNORE, '.agentsmesh/ignore');
}
