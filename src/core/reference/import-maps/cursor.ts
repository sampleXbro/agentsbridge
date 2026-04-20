import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import { CURSOR_MCP } from '../../../targets/cursor/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_COMMANDS, AB_RULES } from './constants.js';

export async function buildCursorImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(CURSOR_MCP, '.agentsmesh/mcp.json');
    refs.set('.cursor/AGENTS.md', `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, '.cursor/rules')) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.mdc');
    }
    for (const absPath of await listFiles(projectRoot, '.cursor/commands')) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, '.cursor/agents')) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, '.cursor/skills')) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), '.cursor/skills');
    }
    return;
  }
  refs.set('AGENTS.md', `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, '.cursor/rules')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.mdc');
  }
  for (const absPath of await listFiles(projectRoot, '.cursor/commands')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.cursor/agents')) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.cursor/skills')) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), '.cursor/skills');
  }
}
