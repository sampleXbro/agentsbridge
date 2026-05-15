/**
 * Windsurf skills import adapter - handles projected agent skills and regular skills via
 * the shared orchestrator.
 */

import type { ImportResult } from '../../core/types.js';
import {
  importSkillsDirectory,
  projectedAgentRecognizer,
  type SkillImportOptions,
} from '../import/shared/skill-import-pipeline.js';
import {
  WINDSURF_SKILLS_DIR,
  WINDSURF_CANONICAL_AGENTS_DIR,
  WINDSURF_CANONICAL_SKILLS_DIR,
} from './constants.js';

export async function importSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  skillsRelDir: string = WINDSURF_SKILLS_DIR,
): Promise<void> {
  const options: SkillImportOptions = {
    projectRoot,
    destCanonicalSkillsDir: WINDSURF_CANONICAL_SKILLS_DIR,
    targetName: 'windsurf',
    normalize,
    results,
  };

  await importSkillsDirectory([skillsRelDir], options, [
    projectedAgentRecognizer({ canonicalAgentsDir: WINDSURF_CANONICAL_AGENTS_DIR }),
  ]);
}
