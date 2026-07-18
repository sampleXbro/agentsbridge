import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  TRAE_PROJECT_RULES,
  TRAE_RULES_DIR,
  TRAE_AGENTS_DIR,
  TRAE_COMMANDS_DIR,
  TRAE_GLOBAL_AGENTS_DIR,
  TRAE_GLOBAL_COMMANDS_DIR,
  TRAE_SKILLS_DIR,
  TRAE_GLOBAL_RULES_DIR,
  TRAE_GLOBAL_ROOT_RULE,
  TRAE_GLOBAL_SKILLS_DIR,
} from '../../../targets/trae/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_RULES, AB_COMMANDS } from './constants.js';

export async function buildTraeImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(TRAE_GLOBAL_ROOT_RULE, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, TRAE_GLOBAL_RULES_DIR)) {
      const relPath = rel(projectRoot, absPath);
      if (relPath === TRAE_GLOBAL_ROOT_RULE) continue;
      addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
    }
    for (const absPath of await listFiles(projectRoot, TRAE_GLOBAL_COMMANDS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, TRAE_GLOBAL_AGENTS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, TRAE_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), TRAE_GLOBAL_SKILLS_DIR);
    }
    return;
  }

  refs.set(TRAE_PROJECT_RULES, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, TRAE_RULES_DIR)) {
    const relPath = rel(projectRoot, absPath);
    if (relPath === TRAE_PROJECT_RULES) continue;
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, TRAE_AGENTS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, TRAE_COMMANDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, TRAE_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), TRAE_SKILLS_DIR);
  }
}
