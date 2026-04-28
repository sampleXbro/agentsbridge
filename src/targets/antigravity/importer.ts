import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { mkdirp, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { splitEmbeddedRulesToCanonical } from '../import/embedded-rules.js';
import {
  ANTIGRAVITY_TARGET,
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_ROOT_LEGACY,
  ANTIGRAVITY_SKILLS_DIR,
  ANTIGRAVITY_GLOBAL_ROOT,
  ANTIGRAVITY_GLOBAL_SKILLS_DIR,
  ANTIGRAVITY_CANONICAL_ROOT_RULE,
  ANTIGRAVITY_CANONICAL_RULES_DIR,
} from './constants.js';
import { descriptor } from './index.js';

type Normalize = (content: string, sourceFile: string, destinationFile: string) => string;

/** Splits embedded non-root rules out of the root file; not declarable through the runner today. */
async function importRootRule(
  projectRoot: string,
  results: ImportResult[],
  normalize: Normalize,
  scope: TargetLayoutScope,
): Promise<void> {
  const primary = scope === 'global' ? ANTIGRAVITY_GLOBAL_ROOT : ANTIGRAVITY_RULES_ROOT;
  const candidates = scope === 'project' ? [primary, ANTIGRAVITY_RULES_ROOT_LEGACY] : [primary];
  for (const rel of candidates) {
    const srcPath = join(projectRoot, rel);
    const content = await readFileSafe(srcPath);
    if (content === null) continue;
    const destPath = join(projectRoot, ANTIGRAVITY_CANONICAL_ROOT_RULE);
    const split = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: ANTIGRAVITY_CANONICAL_RULES_DIR,
      sourcePath: srcPath,
      fromTool: ANTIGRAVITY_TARGET,
      normalize,
    });
    results.push(...split.results);
    const { body } = parseFrontmatter(normalize(split.rootContent, srcPath, destPath));
    const output = await serializeImportedRuleWithFallback(destPath, { root: true }, body);
    await mkdirp(join(projectRoot, ANTIGRAVITY_CANONICAL_RULES_DIR));
    await writeFileAtomic(destPath, output);
    results.push({
      fromTool: ANTIGRAVITY_TARGET,
      fromPath: srcPath,
      toPath: ANTIGRAVITY_CANONICAL_ROOT_RULE,
      feature: 'rules',
    });
    return;
  }
}

export async function importFromAntigravity(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(ANTIGRAVITY_TARGET, projectRoot, scope);
  await importRootRule(projectRoot, results, normalize, scope);
  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));
  await importEmbeddedSkills(
    projectRoot,
    scope === 'global' ? ANTIGRAVITY_GLOBAL_SKILLS_DIR : ANTIGRAVITY_SKILLS_DIR,
    ANTIGRAVITY_TARGET,
    results,
    normalize,
  );
  return results;
}
