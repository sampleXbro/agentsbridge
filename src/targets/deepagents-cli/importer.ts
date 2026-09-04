/**
 * Import Deep Agents CLI config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `.deepagents/AGENTS.md`  — root rule
 *   - `.deepagents/skills/`    — skill bundles (+ commands projected as skills)
 *   - `.deepagents/agents/`    — native subagent files
 *   - `.mcp.json`              — MCP servers (standard format)
 *   - `~/.deepagents/hooks.json` — lifecycle hooks (global scope only; no
 *     declarative importer mode fits its bespoke array shape, so this is
 *     imperative — see `global-hooks.ts`)
 *   - `~/.deepagents/config.toml` — shell.allow_list permissions (global scope
 *     only — see `global-permissions.ts`)
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { importDeepagentsCliGlobalHooks } from './global-hooks.js';
import { importDeepagentsCliGlobalPermissions } from './global-permissions.js';
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

  if (scope === 'global') {
    await importDeepagentsCliGlobalHooks(projectRoot, results);
    await importDeepagentsCliGlobalPermissions(projectRoot, results);
  }

  return results;
}
