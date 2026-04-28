/**
 * Copilot target importer.
 *
 * Declarative parts (root rule, legacy + new rule directories, prompt commands,
 * `.agent.md` agents) live in `descriptor.importer` and are dispatched by the
 * shared runner — including scope variance (project vs `~/.copilot/`).
 *
 * Imperative parts (skills tree traversal via `findDirectorySkills`, the
 * Copilot hooks JSON parser, and the legacy hook script directory) stay here.
 * Hooks are project-only, expressed by simply not declaring a `hooks` source
 * in the descriptor — no `if (scope === 'global')` branch needed.
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { COPILOT_TARGET, COPILOT_GLOBAL_SKILLS_DIR, COPILOT_SKILLS_DIR } from './constants.js';
import { importHooks } from './hook-parser.js';
import { importSkills } from './skills-adapter.js';
import { descriptor } from './index.js';

export async function importFromCopilot(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(COPILOT_TARGET, projectRoot, scope);
  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));
  await importSkills(
    projectRoot,
    results,
    normalize,
    scope === 'global' ? COPILOT_GLOBAL_SKILLS_DIR : COPILOT_SKILLS_DIR,
  );
  if (scope === 'project') await importHooks(projectRoot, results);
  return results;
}
