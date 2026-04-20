/**
 * Codex CLI importer — imports canonical config from Codex project files.
 *
 * Sources imported:
 *   AGENTS.md (preferred) / codex.md (fallback) → .agentsmesh/rules/_root.md
 *   .codex/instructions/*.md        → .agentsmesh/rules/*.md
 *   .agents/skills/am-command-{name}/SKILL.md   → .agentsmesh/commands/{name}.md
 *   .agents/skills/{name}/SKILL.md → .agentsmesh/skills/{name}/SKILL.md
 *   .codex/config.toml            → .agentsmesh/mcp.json (mcp_servers section)
 *   .codex/rules/*.rules (embed)  → .agentsmesh/rules/*.md (agentsmesh block)
 *   .codex/rules/*.md (legacy)    → .agentsmesh/rules/*.md
 *   nested AGENTS.md               → .agentsmesh/rules (scoped)
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { CODEX_TARGET } from './constants.js';
import { importMcp } from './mcp-helpers.js';
import { importSkills } from './skills-adapter.js';
import { importCodexAgentsFromToml } from './importer-agents.js';
import { importCodexRules } from './importer-rules.js';

/**
 * Import Codex config into canonical .agentsmesh/.
 *
 * @param projectRoot - Project root directory (repo root, or user home for global scope)
 * @param options - When `scope` is `global`, skips recursive nested `AGENTS.md` discovery under `projectRoot` (must not scan the entire home directory).
 * @returns Import results for each imported file
 */
export async function importFromCodex(
  projectRoot: string,
  options?: { scope?: TargetLayoutScope },
): Promise<ImportResult[]> {
  const layoutScope: TargetLayoutScope = options?.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(CODEX_TARGET, projectRoot, layoutScope);
  const normalizeWindsurf = await createImportReferenceNormalizer(
    'windsurf',
    projectRoot,
    layoutScope,
  );

  await importCodexRules(projectRoot, results, normalize, normalizeWindsurf, layoutScope);
  await importSkills(projectRoot, results, normalize);
  await importCodexAgentsFromToml(projectRoot, results, normalize);
  await importMcp(projectRoot, results);

  return results;
}
