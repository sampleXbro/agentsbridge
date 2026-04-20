import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  ROO_CODE_ROOT_RULE,
  ROO_CODE_ROOT_RULE_FALLBACK,
  ROO_CODE_RULES_DIR,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_GLOBAL_AGENTS_MD,
  ROO_CODE_GLOBAL_RULES_DIR,
  ROO_CODE_GLOBAL_COMMANDS_DIR,
  ROO_CODE_GLOBAL_SKILLS_DIR,
  ROO_CODE_GLOBAL_MCP_FILE,
} from '../../../targets/roo-code/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_COMMANDS, AB_RULES } from './constants.js';

export async function buildRooCodeImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(ROO_CODE_GLOBAL_AGENTS_MD, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, ROO_CODE_GLOBAL_RULES_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
    }
    for (const absPath of await listFiles(projectRoot, ROO_CODE_GLOBAL_COMMANDS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, ROO_CODE_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), ROO_CODE_GLOBAL_SKILLS_DIR);
    }
    refs.set(ROO_CODE_GLOBAL_MCP_FILE, '.agentsmesh/mcp.json');
    return;
  }
  refs.set(ROO_CODE_ROOT_RULE, `${AB_RULES}/_root.md`);
  refs.set(ROO_CODE_ROOT_RULE_FALLBACK, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, ROO_CODE_RULES_DIR)) {
    const relPath = rel(projectRoot, absPath);
    if (relPath === ROO_CODE_ROOT_RULE) continue;
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, '.roo')) {
    const relPath = rel(projectRoot, absPath);
    if (/^\.roo\/rules-[^/]+\/.+\.md$/.test(relPath)) {
      addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
    }
  }
  for (const absPath of await listFiles(projectRoot, ROO_CODE_COMMANDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, ROO_CODE_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), ROO_CODE_SKILLS_DIR);
  }
}
