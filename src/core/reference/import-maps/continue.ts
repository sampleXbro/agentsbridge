import { basename } from 'node:path';
import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  CONTINUE_ROOT_RULE,
  CONTINUE_ROOT_RULE_LEGACY,
} from '../../../targets/continue/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_COMMANDS, AB_RULES } from './constants.js';

export async function buildContinueImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  refs.set(CONTINUE_ROOT_RULE, `${AB_RULES}/_root.md`);
  refs.set(CONTINUE_ROOT_RULE_LEGACY, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.continue/rules')) {
    const relPath = rel(projectRoot, absPath);
    if (relPath === CONTINUE_ROOT_RULE || relPath === CONTINUE_ROOT_RULE_LEGACY) continue;
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.continue/prompts')) {
    refs.set(rel(projectRoot, absPath), `${AB_COMMANDS}/${basename(absPath, '.md')}.md`);
  }
  for (const absPath of await listFiles(projectRoot, '.continue/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.continue/skills');
  }
  if (scope === 'global') {
    for (const absPath of await listFiles(projectRoot, '.agents/skills')) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), '.agents/skills');
    }
  }
}
