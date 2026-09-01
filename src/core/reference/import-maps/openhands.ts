import { basename } from 'node:path';
import { addSimpleFileMapping, addSkillLikeMapping, listFiles, rel } from '../import-map-shared.js';
import {
  OPENHANDS_ROOT_FILE,
  OPENHANDS_SKILLS_DIR,
  OPENHANDS_AGENTS_DIR,
  OPENHANDS_COMMANDS_DIR,
  OPENHANDS_GLOBAL_ROOT_FILE,
} from '../../../targets/openhands/constants.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import { AB_AGENTS, AB_COMMANDS, AB_RULES } from './constants.js';

/**
 * A markdown file directly under `.agents/skills/` is a RULE for OpenHands, not
 * a flat skill, so it maps to `.agentsmesh/rules/` instead of going through the
 * shared skill mapping. Nested paths are the real skill bundles.
 */
function addSkillsDirMapping(refs: Map<string, string>, relPath: string): void {
  const rest = relPath.slice(OPENHANDS_SKILLS_DIR.length + 1);
  if (rest.includes('/')) {
    addSkillLikeMapping(refs, relPath, OPENHANDS_SKILLS_DIR);
    return;
  }
  if (!rest.endsWith('.md') || basename(rest) === '_root.md') return;
  addSimpleFileMapping(refs, relPath, AB_RULES, '.md');
}

export async function buildOpenhandsImportPaths(
  refs: Map<string, string>,
  projectRoot: string,
  scope: TargetLayoutScope = 'project',
): Promise<void> {
  refs.set(
    scope === 'global' ? OPENHANDS_GLOBAL_ROOT_FILE : OPENHANDS_ROOT_FILE,
    `${AB_RULES}/_root.md`,
  );

  for (const absPath of await listFiles(projectRoot, OPENHANDS_SKILLS_DIR)) {
    addSkillsDirMapping(refs, rel(projectRoot, absPath));
  }
  for (const absPath of await listFiles(projectRoot, OPENHANDS_AGENTS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_AGENTS, '.md');
  }
  for (const absPath of await listFiles(projectRoot, OPENHANDS_COMMANDS_DIR)) {
    addSimpleFileMapping(refs, rel(projectRoot, absPath), AB_COMMANDS, '.md');
  }
}
