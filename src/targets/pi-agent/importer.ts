/**
 * Import Pi Coding Agent config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `AGENTS.md`      -- root rule
 *   - `.pi/skills/`    -- skill bundles
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { PI_AGENT_TARGET, PI_AGENT_SKILLS_DIR, PI_AGENT_GLOBAL_SKILLS_DIR } from './constants.js';
import { descriptor } from './index.js';

export async function importFromPiAgent(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(PI_AGENT_TARGET, projectRoot, scope);

  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  const skillsDir = scope === 'global' ? PI_AGENT_GLOBAL_SKILLS_DIR : PI_AGENT_SKILLS_DIR;
  await importEmbeddedSkills(projectRoot, skillsDir, PI_AGENT_TARGET, results, normalize);

  return results;
}
