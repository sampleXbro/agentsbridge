import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import { JUNIE_DOT_AGENTS, JUNIE_GUIDELINES } from '../../../targets/junie/constants.js';
import { AB_AGENTS, AB_COMMANDS, AB_RULES } from './constants.js';

export async function buildJunieImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set(JUNIE_GUIDELINES, `${AB_RULES}/_root.md`);
  refs.set(JUNIE_DOT_AGENTS, `${AB_RULES}/_root.md`);
  refs.set('AGENTS.md', `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.junie/rules')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.junie/commands')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.junie/agents')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.junie/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.junie/skills');
  }
}
