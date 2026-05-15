/**
 * Codex CLI skills import adapter - handles command skills, agent projections, and regular
 * skills via the shared orchestrator. Tries the primary skills dir, then a fallback dir.
 */

import type { ImportResult } from '../../core/types.js';
import {
  commandSkillRecognizer,
  importSkillsDirectory,
  projectedAgentRecognizer,
  type SkillImportOptions,
} from '../import/shared/skill-import-pipeline.js';
import {
  CODEX_TARGET,
  CODEX_SKILLS_DIR,
  CODEX_SKILLS_FALLBACK_DIR,
  CODEX_CANONICAL_COMMANDS_DIR,
  CODEX_CANONICAL_AGENTS_DIR,
  CODEX_CANONICAL_SKILLS_DIR,
} from './constants.js';

export async function importSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const options: SkillImportOptions = {
    projectRoot,
    destCanonicalSkillsDir: CODEX_CANONICAL_SKILLS_DIR,
    targetName: CODEX_TARGET,
    normalize,
    results,
  };

  await importSkillsDirectory([CODEX_SKILLS_DIR, CODEX_SKILLS_FALLBACK_DIR], options, [
    commandSkillRecognizer({ canonicalCommandsDir: CODEX_CANONICAL_COMMANDS_DIR }),
    projectedAgentRecognizer({ canonicalAgentsDir: CODEX_CANONICAL_AGENTS_DIR }),
  ]);
}
