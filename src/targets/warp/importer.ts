/**
 * Import Warp config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `WARP.md` / `AGENTS.md` — root rule (legacy WARP.md takes priority)
 *   - `.warp/skills/`         — skill bundles
 *   - `.mcp.json`             — MCP servers (standard format)
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { WARP_TARGET, WARP_SKILLS_DIR, WARP_GLOBAL_SKILLS_DIR } from './constants.js';
import { descriptor } from './index.js';

export async function importFromWarp(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(WARP_TARGET, projectRoot, scope);

  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  const skillsDir = scope === 'global' ? WARP_GLOBAL_SKILLS_DIR : WARP_SKILLS_DIR;
  await importEmbeddedSkills(projectRoot, skillsDir, WARP_TARGET, results, normalize);

  return results;
}
