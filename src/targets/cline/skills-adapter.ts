/**
 * Cline skills import adapter - handles projected agent skills and regular skills via the
 * shared orchestrator.
 */

import type { ImportResult } from '../../core/types.js';
import {
  importSkillsDirectory,
  projectedAgentRecognizer,
  type SkillImportOptions,
} from '../import/shared/skill-import-pipeline.js';
import {
  CLINE_SKILLS_DIR,
  CLINE_CANONICAL_AGENTS_DIR,
  CLINE_CANONICAL_SKILLS_DIR,
} from './constants.js';

export async function importClineSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  skillsRelDir: string = CLINE_SKILLS_DIR,
): Promise<void> {
  const options: SkillImportOptions = {
    projectRoot,
    destCanonicalSkillsDir: CLINE_CANONICAL_SKILLS_DIR,
    targetName: 'cline',
    normalize,
    results,
  };

  await importSkillsDirectory([skillsRelDir], options, [
    projectedAgentRecognizer({ canonicalAgentsDir: CLINE_CANONICAL_AGENTS_DIR }),
  ]);
}
