import {
  addScopedAgentsMappings,
  addSimpleFileMapping,
  addSkillLikeMapping,
  listFiles,
  rel,
} from '../import-map-shared.js';
import { AB_COMMANDS, AB_RULES } from './constants.js';

export async function buildWindsurfImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
): Promise<void> {
  refs.set('AGENTS.md', `${AB_RULES}/_root.md`);
  refs.set('.windsurfrules', `${AB_RULES}/_root.md`);
  await addScopedAgentsMappings(refs, projectRoot);
  for (const absPath of await listFiles(projectRoot, '.windsurf/rules')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.windsurf/workflows')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.windsurf/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.windsurf/skills');
  }
}
