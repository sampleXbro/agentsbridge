import { basename } from 'node:path';
import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  CLINE_GLOBAL_RULES_DIR,
  CLINE_GLOBAL_WORKFLOWS_DIR,
  CLINE_GLOBAL_SKILLS_DIR,
  CLINE_RULES_DIR,
  CLINE_SKILLS_DIR,
  CLINE_WORKFLOWS_DIR,
} from '../../../targets/cline/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_COMMANDS, AB_RULES } from './constants.js';

/**
 * Agents are not mapped here: `.cline/agents.yaml` (project-only, no
 * documented global equivalent) is a single combined YAML file, not one
 * generated file per agent, so there is no per-entry destination path for
 * cross-file link rewriting to target.
 */
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
    for (const absPath of await listFiles(projectRoot, CLINE_GLOBAL_SKILLS_DIR)) {
      addSkillLikeMapping(refs, rel(projectRoot, absPath), CLINE_GLOBAL_SKILLS_DIR);
    }
    return;
  }

  refs.set(`${CLINE_RULES_DIR}/_root.md`, `${AB_RULES}/_root.md`);
  for (const absPath of await listFiles(projectRoot, CLINE_RULES_DIR)) {
    const relPath = rel(projectRoot, absPath);
    if (!relPath.endsWith('.md') || basename(relPath) === '_root.md') {
      continue;
    }
    addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
  }
  for (const absPath of await listFiles(projectRoot, CLINE_WORKFLOWS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, CLINE_SKILLS_DIR)) {
    addSkillLikeMapping(refs, rel(projectRoot, absPath), CLINE_SKILLS_DIR);
  }
}
