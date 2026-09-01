import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  KIMI_CODE_ROOT_FILE,
  KIMI_CODE_NESTED_ROOT_FILE,
  KIMI_CODE_AGENTS_DIR,
  KIMI_CODE_SKILLS_DIR,
  KIMI_CODE_GLOBAL_ROOT_FILE,
  KIMI_CODE_SHARED_GLOBAL_ROOT_FILE,
  KIMI_CODE_GLOBAL_AGENTS_DIR,
  KIMI_CODE_GLOBAL_SKILLS_DIR,
} from '../../../targets/kimi-code/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_RULES } from './constants.js';

/**
 * Kimi Code target paths -> canonical paths. Non-root rules have no file of
 * their own (they are embedded in the instruction file), so only the root file,
 * agents and skills carry mappings. Both instruction paths Kimi Code accepts
 * map to the same canonical root rule.
 */
export async function buildKimiCodeImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  const isGlobal = scope === 'global';
  const rootFiles = isGlobal
    ? [KIMI_CODE_GLOBAL_ROOT_FILE, KIMI_CODE_SHARED_GLOBAL_ROOT_FILE]
    : [KIMI_CODE_ROOT_FILE, KIMI_CODE_NESTED_ROOT_FILE];
  for (const rootFile of rootFiles) refs.set(rootFile, `${AB_RULES}/_root.md`);

  const agentsDir = isGlobal ? KIMI_CODE_GLOBAL_AGENTS_DIR : KIMI_CODE_AGENTS_DIR;
  for (const absPath of await listFiles(projectRoot, agentsDir)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }

  const skillsDir = isGlobal ? KIMI_CODE_GLOBAL_SKILLS_DIR : KIMI_CODE_SKILLS_DIR;
  for (const absPath of await listFiles(projectRoot, skillsDir)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), skillsDir);
  }
}
