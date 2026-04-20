import { basename } from 'node:path';
import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  CLINE_GLOBAL_RULES_DIR,
  CLINE_GLOBAL_WORKFLOWS_DIR,
  CLINE_SKILLS_DIR,
  CLINE_MCP_SETTINGS,
} from '../../../targets/cline/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_COMMANDS, AB_RULES } from './constants.js';

export async function buildClineImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    for (const absPath of await listFiles(projectRoot, CLINE_GLOBAL_RULES_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
    }
    for (const absPath of await listFiles(projectRoot, CLINE_GLOBAL_WORKFLOWS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, CLINE_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), CLINE_SKILLS_DIR);
    }
    refs.set(CLINE_MCP_SETTINGS, '.agentsmesh/mcp.json');
    return;
  }

  refs.set('.clinerules/_root.md', `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.clinerules')) {
    const relPath = rel(projectRoot, absPath);
    if (
      !relPath.endsWith('.md') ||
      relPath.includes('/workflows/') ||
      basename(relPath) === '_root.md'
    ) {
      continue;
    }
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.clinerules/workflows')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.cline/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.cline/skills');
  }
}
