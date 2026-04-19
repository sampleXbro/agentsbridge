/**
 * Windsurf skills import adapter - thin wrapper around shared pipeline.
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import {
  findDirectorySkills,
  importDirectorySkill,
  type SkillImportOptions,
} from '../import/shared/skill-import-pipeline.js';
import { WINDSURF_SKILLS_DIR, WINDSURF_CANONICAL_SKILLS_DIR } from './constants.js';

export async function importSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  skillsRelDir: string = WINDSURF_SKILLS_DIR,
): Promise<void> {
  const skillsDir = join(projectRoot, skillsRelDir);
  const directorySkills = await findDirectorySkills(skillsDir);

  const options: SkillImportOptions = {
    projectRoot,
    sourceSkillsDir: skillsRelDir,
    destCanonicalSkillsDir: WINDSURF_CANONICAL_SKILLS_DIR,
    targetName: 'windsurf',
    normalize,
    results,
  };

  for (const [skillName, skillDir] of directorySkills) {
    await importDirectorySkill(skillName, skillDir, options);
  }
}
