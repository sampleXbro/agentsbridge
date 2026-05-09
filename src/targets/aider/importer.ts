/**
 * Import Aider config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `CONVENTIONS.md`    — root rule
 *   - `.aider/skills/`    — skill bundles
 *   - `.aiderignore`      — ignore patterns
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { AIDER_TARGET, AIDER_SKILLS_DIR, AIDER_GLOBAL_SKILLS_DIR } from './constants.js';
import { descriptor } from './index.js';

export async function importFromAider(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(AIDER_TARGET, projectRoot, scope);

  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  const skillsDir = scope === 'global' ? AIDER_GLOBAL_SKILLS_DIR : AIDER_SKILLS_DIR;
  await importEmbeddedSkills(projectRoot, skillsDir, AIDER_TARGET, results, normalize);

  return results;
}
