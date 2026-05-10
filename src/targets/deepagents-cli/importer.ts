/**
 * Import Deep Agents CLI config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `.deepagents/AGENTS.md` — root rule
 *   - `.deepagents/skills/`   — skill bundles
 *   - `.mcp.json`             — MCP servers (standard format)
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import {
  DEEPAGENTS_CLI_TARGET,
  DEEPAGENTS_CLI_SKILLS_DIR,
  DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR,
} from './constants.js';
import { descriptor } from './index.js';

export async function importFromDeepagentsCli(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(
    DEEPAGENTS_CLI_TARGET,
    projectRoot,
    scope,
  );

  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  const skillsDir =
    scope === 'global' ? DEEPAGENTS_CLI_GLOBAL_SKILLS_DIR : DEEPAGENTS_CLI_SKILLS_DIR;
  await importEmbeddedSkills(projectRoot, skillsDir, DEEPAGENTS_CLI_TARGET, results, normalize);

  return results;
}
