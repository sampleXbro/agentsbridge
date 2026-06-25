/**
 * Import Factory Droid config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `AGENTS.md`          — root rule
 *   - `.factory/commands/` — native slash commands → canonical commands
 *   - `.factory/droids/`   — native droid definitions → canonical agents
 *   - `.factory/skills/`   — skill bundles
 *   - `.factory/mcp.json`  — MCP servers
 *   - `.factory/hooks.json`— wrapped command hooks → canonical hooks.yaml
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { importWrappedCommandHooks } from '../import/wrapped-command-hooks.js';
import { importFactoryDroidMcp } from './mcp-import.js';
import {
  FACTORY_DROID_TARGET,
  FACTORY_DROID_SKILLS_DIR,
  FACTORY_DROID_MCP_FILE,
  FACTORY_DROID_HOOKS_FILE,
  FACTORY_DROID_CANONICAL_HOOKS,
  FACTORY_DROID_GLOBAL_SKILLS_DIR,
  FACTORY_DROID_GLOBAL_MCP_FILE,
} from './constants.js';
import { descriptor } from './index.js';

export async function importFromFactoryDroid(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(FACTORY_DROID_TARGET, projectRoot, scope);

  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  const skillsDir = scope === 'global' ? FACTORY_DROID_GLOBAL_SKILLS_DIR : FACTORY_DROID_SKILLS_DIR;
  await importEmbeddedSkills(projectRoot, skillsDir, FACTORY_DROID_TARGET, results, normalize);

  const mcpFile = scope === 'global' ? FACTORY_DROID_GLOBAL_MCP_FILE : FACTORY_DROID_MCP_FILE;
  await importFactoryDroidMcp(projectRoot, mcpFile, results);

  // Hooks live at `.factory/hooks.json` in both scopes (rebased to ~/.factory/
  // in global mode), so the path is scope-independent.
  await importWrappedCommandHooks({
    projectRoot,
    hooksFile: FACTORY_DROID_HOOKS_FILE,
    canonicalHooksPath: FACTORY_DROID_CANONICAL_HOOKS,
    targetName: FACTORY_DROID_TARGET,
    results,
  });

  return results;
}
