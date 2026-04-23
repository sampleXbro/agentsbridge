import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_ROOT_LEGACY,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
  ANTIGRAVITY_SKILLS_DIR,
  ANTIGRAVITY_GLOBAL_ROOT,
  ANTIGRAVITY_GLOBAL_SKILLS_DIR,
  ANTIGRAVITY_GLOBAL_MCP_CONFIG,
} from '../../../targets/antigravity/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_COMMANDS, AB_RULES } from './constants.js';

export async function buildAntigravityImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(ANTIGRAVITY_GLOBAL_ROOT, `${AB_RULES}/_root.md`);
    for (const absPath of await listFiles(projectRoot, ANTIGRAVITY_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), ANTIGRAVITY_GLOBAL_SKILLS_DIR);
    }
    refs.set(ANTIGRAVITY_GLOBAL_MCP_CONFIG, '.agentsmesh/mcp.json');
    return;
  }

  refs.set(ANTIGRAVITY_RULES_ROOT, `${AB_RULES}/_root.md`);
  refs.set(ANTIGRAVITY_RULES_ROOT_LEGACY, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, ANTIGRAVITY_RULES_DIR)) {
    const relPath = rel(projectRoot, absPath);
    if (relPath === ANTIGRAVITY_RULES_ROOT || relPath === ANTIGRAVITY_RULES_ROOT_LEGACY) continue;
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, ANTIGRAVITY_WORKFLOWS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, ANTIGRAVITY_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), ANTIGRAVITY_SKILLS_DIR);
  }
}
