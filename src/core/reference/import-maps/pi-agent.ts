import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  PI_AGENT_ROOT_FILE,
  PI_AGENT_SKILLS_DIR,
  PI_AGENT_COMMANDS_DIR,
  PI_AGENT_GLOBAL_ROOT_FILE,
  PI_AGENT_GLOBAL_SKILLS_DIR,
  PI_AGENT_GLOBAL_COMMANDS_DIR,
} from '../../../targets/pi-agent/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_COMMANDS, AB_RULES } from './constants.js';

export async function buildPiAgentImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(PI_AGENT_GLOBAL_ROOT_FILE, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, PI_AGENT_GLOBAL_COMMANDS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, PI_AGENT_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), PI_AGENT_GLOBAL_SKILLS_DIR);
    }
    return;
  }

  refs.set(PI_AGENT_ROOT_FILE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, PI_AGENT_COMMANDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, PI_AGENT_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), PI_AGENT_SKILLS_DIR);
  }
}
