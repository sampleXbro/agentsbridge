/**
 * Import Goose config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `.goosehints`       — root rule
 *   - `.agents/skills/`   — skill bundles
 *   - `.gooseignore`      — ignore patterns
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { GOOSE_TARGET, GOOSE_SKILLS_DIR, GOOSE_GLOBAL_SKILLS_DIR } from './constants.js';
import { descriptor } from './index.js';

export async function importFromGoose(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(GOOSE_TARGET, projectRoot, scope);

  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  const skillsDir = scope === 'global' ? GOOSE_GLOBAL_SKILLS_DIR : GOOSE_SKILLS_DIR;
  await importEmbeddedSkills(projectRoot, skillsDir, GOOSE_TARGET, results, normalize);

  return results;
}
