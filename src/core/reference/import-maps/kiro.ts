import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  KIRO_AGENTS_MD,
  KIRO_AGENTS_DIR,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_GLOBAL_STEERING_DIR,
  KIRO_GLOBAL_STEERING_AGENTS_MD,
  KIRO_GLOBAL_SKILLS_DIR,
  KIRO_GLOBAL_AGENTS_DIR,
} from '../../../targets/kiro/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_RULES } from './constants.js';

export async function buildKiroImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(KIRO_GLOBAL_STEERING_AGENTS_MD, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, KIRO_GLOBAL_STEERING_DIR)) {
      const relPath = rel(projectRoot, absPath);
      if (relPath === KIRO_GLOBAL_STEERING_AGENTS_MD) continue;
      addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
    }
    for (const absPath of await listFiles(projectRoot, KIRO_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), KIRO_GLOBAL_SKILLS_DIR);
    }
    for (const absPath of await listFiles(projectRoot, KIRO_GLOBAL_AGENTS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
    }
    return;
  }
  refs.set(KIRO_AGENTS_MD, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, KIRO_STEERING_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, KIRO_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), KIRO_SKILLS_DIR);
  }
  for (const absPath of await listFiles(projectRoot, KIRO_AGENTS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
}
