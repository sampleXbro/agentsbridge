import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_COMMANDS, AB_RULES } from './constants.js';
import {
  QWEN_ROOT,
  QWEN_RULES_DIR,
  QWEN_COMMANDS_DIR,
  QWEN_AGENTS_DIR,
  QWEN_SKILLS_DIR,
  QWEN_IGNORE,
  QWEN_GLOBAL_ROOT,
  QWEN_GLOBAL_RULES_DIR,
  QWEN_GLOBAL_COMMANDS_DIR,
  QWEN_GLOBAL_AGENTS_DIR,
  QWEN_GLOBAL_SKILLS_DIR,
  QWEN_GLOBAL_SETTINGS,
  QWEN_SETTINGS,
} from '../../../targets/qwen-code/constants.js';

export async function buildQwenCodeImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  if (scope === 'global') {
    refs.set(QWEN_GLOBAL_ROOT, `${AB_RULES}/_root.md`);
    refs.set(QWEN_GLOBAL_SETTINGS, '.agentsmesh/mcp.json');
    for (const absPath of await listFiles(projectRoot, QWEN_GLOBAL_RULES_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
    }
    for (const absPath of await listFiles(projectRoot, QWEN_GLOBAL_COMMANDS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, QWEN_GLOBAL_AGENTS_DIR)) {
      addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
    }
    for (const absPath of await listFiles(projectRoot, QWEN_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), QWEN_GLOBAL_SKILLS_DIR);
    }
    return;
  }

  refs.set(QWEN_ROOT, `${AB_RULES}/_root.md`);
  refs.set(QWEN_SETTINGS, '.agentsmesh/mcp.json');
  refs.set(QWEN_IGNORE, '.agentsmesh/ignore');
  for (const absPath of await listFiles(projectRoot, QWEN_RULES_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, QWEN_COMMANDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, QWEN_AGENTS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, QWEN_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), QWEN_SKILLS_DIR);
  }
}
