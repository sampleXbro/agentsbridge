/**
 * Import Goose config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `.goosehints`       — root rule
 *   - `.agents/skills/`   — skill bundles
 *   - `.gooseignore`      — ignore patterns
 *   - `.agents/plugins/agentsmesh/hooks/hooks.json` — lifecycle hooks
 *   - `.config/goose/permission.yaml` — tool permissions (global scope only)
 */

import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { mkdirp, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { importWrappedCommandHooks } from '../import/wrapped-command-hooks.js';
import {
  GOOSE_TARGET,
  GOOSE_SKILLS_DIR,
  GOOSE_GLOBAL_SKILLS_DIR,
  GOOSE_HOOKS_FILE,
  GOOSE_CANONICAL_HOOKS,
  GOOSE_GLOBAL_PERMISSIONS,
  GOOSE_CANONICAL_PERMISSIONS,
} from './constants.js';
import { parseGoosePermissions } from './permissions.js';
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

  // Hooks live at the same `.agents/plugins/agentsmesh/hooks/hooks.json` in both
  // scopes (rebased under the home dir in global mode), so the path is scope-independent.
  await importWrappedCommandHooks({
    projectRoot,
    hooksFile: GOOSE_HOOKS_FILE,
    canonicalHooksPath: GOOSE_CANONICAL_HOOKS,
    targetName: GOOSE_TARGET,
    results,
  });

  // Permissions are global-only (~/.config/goose/permission.yaml).
  if (scope === 'global') await importPermissions(projectRoot, results);

  return results;
}

async function importPermissions(projectRoot: string, results: ImportResult[]): Promise<void> {
  const srcPath = join(projectRoot, GOOSE_GLOBAL_PERMISSIONS);
  const content = await readFileSafe(srcPath);
  if (content === null) return;
  const permissions = parseGoosePermissions(content);
  if (!permissions) return;
  const destPath = join(projectRoot, GOOSE_CANONICAL_PERMISSIONS);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, stringifyYaml(permissions).trimEnd() + '\n');
  results.push({
    fromTool: GOOSE_TARGET,
    fromPath: srcPath,
    toPath: GOOSE_CANONICAL_PERMISSIONS,
    feature: 'permissions',
  });
}
