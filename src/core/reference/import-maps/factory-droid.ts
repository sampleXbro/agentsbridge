import { addSkillLikeMapping, addSimpleFileMapping, listFiles, rel } from '../import-map-shared.js';
import {
  FACTORY_DROID_ROOT_FILE,
  FACTORY_DROID_SKILLS_DIR,
  FACTORY_DROID_COMMANDS_DIR,
  FACTORY_DROID_DROIDS_DIR,
  FACTORY_DROID_MCP_FILE,
  FACTORY_DROID_GLOBAL_ROOT_FILE,
  FACTORY_DROID_GLOBAL_SKILLS_DIR,
  FACTORY_DROID_GLOBAL_COMMANDS_DIR,
  FACTORY_DROID_GLOBAL_DROIDS_DIR,
  FACTORY_DROID_GLOBAL_MCP_FILE,
} from '../../../targets/factory-droid/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_COMMANDS, AB_RULES } from './constants.js';

export async function buildFactoryDroidImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(FACTORY_DROID_GLOBAL_ROOT_FILE, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, FACTORY_DROID_GLOBAL_COMMANDS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, FACTORY_DROID_GLOBAL_DROIDS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, FACTORY_DROID_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), FACTORY_DROID_GLOBAL_SKILLS_DIR);
    }
    refs.set(FACTORY_DROID_GLOBAL_MCP_FILE, '.agentsmesh/mcp.json');
    return;
  }

  refs.set(FACTORY_DROID_ROOT_FILE, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, FACTORY_DROID_COMMANDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, FACTORY_DROID_DROIDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, FACTORY_DROID_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), FACTORY_DROID_SKILLS_DIR);
  }
  refs.set(FACTORY_DROID_MCP_FILE, '.agentsmesh/mcp.json');
}
