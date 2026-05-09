import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  AUGMENT_CODE_RULES_DIR,
  AUGMENT_CODE_COMMANDS_DIR,
  AUGMENT_CODE_SKILLS_DIR,
  AUGMENT_CODE_SETTINGS_FILE,
  AUGMENT_CODE_IGNORE_FILE,
  AUGMENT_CODE_GLOBAL_RULES_DIR,
  AUGMENT_CODE_GLOBAL_COMMANDS_DIR,
  AUGMENT_CODE_GLOBAL_SKILLS_DIR,
  AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
} from '../../../targets/augment-code/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_RULES, AB_COMMANDS } from './constants.js';

export async function buildAugmentCodeImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    for (const absPath of await listFiles(projectRoot, AUGMENT_CODE_GLOBAL_RULES_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
    }
    for (const absPath of await listFiles(projectRoot, AUGMENT_CODE_GLOBAL_COMMANDS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, AUGMENT_CODE_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), AUGMENT_CODE_GLOBAL_SKILLS_DIR);
    }
    refs.set(AUGMENT_CODE_GLOBAL_SETTINGS_FILE, '.agentsmesh/mcp.json');
    return;
  }

  for (const absPath of await listFiles(projectRoot, AUGMENT_CODE_RULES_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, AUGMENT_CODE_COMMANDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, AUGMENT_CODE_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), AUGMENT_CODE_SKILLS_DIR);
  }
  refs.set(AUGMENT_CODE_SETTINGS_FILE, '.agentsmesh/mcp.json');
  refs.set(AUGMENT_CODE_IGNORE_FILE, '.agentsmesh/ignore');
}
