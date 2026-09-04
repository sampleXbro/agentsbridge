/**
 * Import Codebuff config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `AGENTS.md` (+ nested `<dir>/AGENTS.md`) or `~/.AGENTS.md`
 *   - `.agents/skills/`  — skills and skills projected from commands
 *   - `.agents/mcp.json` — MCP servers (descriptor `mcpJson` spec)
 *   - `.codebuffignore`  — ignore patterns (descriptor `flatFile` spec, project only)
 *
 * `CLAUDE.md` and `~/.CLAUDE.md` are deliberately NOT read. Codebuff loads at
 * most one knowledge file per directory and `AGENTS.md` always wins, so a
 * sibling `CLAUDE.md` is content Codebuff itself ignores — importing it would
 * pull another tool's rules into canonical under Codebuff's name.
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { importCodebuffRules } from './import-rules.js';
import { CODEBUFF_TARGET, CODEBUFF_SKILLS_DIR, CODEBUFF_GLOBAL_SKILLS_DIR } from './constants.js';
import { descriptor } from './index.js';

export async function importFromCodebuff(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const normalize = await createImportReferenceNormalizer(CODEBUFF_TARGET, projectRoot, scope);
  const results: ImportResult[] = [];

  results.push(...(await importCodebuffRules(projectRoot, scope, normalize)));
  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  const skillsDir = scope === 'global' ? CODEBUFF_GLOBAL_SKILLS_DIR : CODEBUFF_SKILLS_DIR;
  await importEmbeddedSkills(projectRoot, skillsDir, CODEBUFF_TARGET, results, normalize);

  return results;
}
