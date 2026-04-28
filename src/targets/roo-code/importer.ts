import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { rooNonRootRuleMapper } from './import-mappers.js';
import {
  ROO_CODE_TARGET,
  ROO_CODE_DIR,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_CANONICAL_RULES_DIR,
} from './constants.js';
import { descriptor } from './index.js';

/**
 * Roo can ship rule directories named `rules-<mode>`; the set is dynamic, so it
 * stays imperative. Each discovered directory is funneled through the same
 * non-root rule mapper used by the descriptor's primary rules spec.
 */
async function importPerModeRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const rooDir = join(projectRoot, ROO_CODE_DIR);
  let entries;
  try {
    entries = await readdir(rooDir, { withFileTypes: true });
  } catch {
    return;
  }
  const modeRuleDirs = entries
    .filter((e) => e.isDirectory() && e.name.startsWith('rules-'))
    .map((e) => e.name);
  const destDir = join(projectRoot, ROO_CODE_CANONICAL_RULES_DIR);
  for (const dirName of modeRuleDirs) {
    results.push(
      ...(await importFileDirectory({
        srcDir: join(rooDir, dirName),
        destDir,
        extensions: ['.md'],
        fromTool: ROO_CODE_TARGET,
        normalize,
        mapEntry: async ({ srcPath, relativePath, content, normalizeTo }) => {
          const mapping = await rooNonRootRuleMapper({
            absolutePath: srcPath,
            relativePath,
            content,
            destDir,
            normalizeTo,
          });
          if (!mapping) return null;
          return { ...mapping, feature: 'rules' };
        },
      })),
    );
  }
}

export async function importFromRooCode(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(ROO_CODE_TARGET, projectRoot, scope);
  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));
  await importPerModeRules(projectRoot, results, normalize);
  await importEmbeddedSkills(projectRoot, ROO_CODE_SKILLS_DIR, ROO_CODE_TARGET, results, normalize);
  return results;
}
