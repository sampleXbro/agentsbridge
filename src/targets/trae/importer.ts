import { basename, join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import {
  TRAE_TARGET,
  TRAE_PROJECT_RULES,
  TRAE_RULES_DIR,
  TRAE_SKILLS_DIR,
  TRAE_GLOBAL_RULES_DIR,
  TRAE_GLOBAL_ROOT_RULE,
  TRAE_GLOBAL_SKILLS_DIR,
  TRAE_CANONICAL_RULES_DIR,
} from './constants.js';
import { descriptor } from './index.js';

type Normalize = (content: string, sourceFile: string, destinationFile: string) => string;

const CANONICAL_ROOT_RULE = `${TRAE_CANONICAL_RULES_DIR}/_root.md`;

/** Import the root instruction file (project_rules.md or global user_rules/rules.md). */
async function importRoot(
  projectRoot: string,
  results: ImportResult[],
  normalize: Normalize,
  scope: TargetLayoutScope,
): Promise<void> {
  const candidates =
    scope === 'global'
      ? [TRAE_GLOBAL_ROOT_RULE, TRAE_PROJECT_RULES]
      : [TRAE_PROJECT_RULES, TRAE_GLOBAL_ROOT_RULE];

  for (const rel of candidates) {
    const srcPath = join(projectRoot, rel);
    const content = await readFileSafe(srcPath);
    if (content === null) continue;
    const destPath = join(projectRoot, CANONICAL_ROOT_RULE);
    const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, destPath));
    await mkdirp(join(projectRoot, TRAE_CANONICAL_RULES_DIR));
    await writeFileAtomic(
      destPath,
      await serializeImportedRuleWithFallback(destPath, { ...frontmatter, root: true }, body),
    );
    results.push({
      fromTool: TRAE_TARGET,
      fromPath: srcPath,
      toPath: CANONICAL_ROOT_RULE,
      feature: 'rules',
    });
    return;
  }
}

/** Import non-root rules from .trae/rules/*.md (skipping project_rules.md). */
async function importNonRootRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: Normalize,
  scope: TargetLayoutScope,
): Promise<void> {
  const srcDir = join(projectRoot, scope === 'global' ? TRAE_GLOBAL_RULES_DIR : TRAE_RULES_DIR);
  const destDir = join(projectRoot, TRAE_CANONICAL_RULES_DIR);

  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: TRAE_TARGET,
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
        const filename = basename(relativePath);
        // Skip the root rules file
        if (filename === 'project_rules.md' || filename === 'rules.md') return null;
        const destPath = join(destDir, relativePath);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        return {
          destPath,
          toPath: `${TRAE_CANONICAL_RULES_DIR}/${relativePath}`,
          feature: 'rules',
          content: await serializeImportedRuleWithFallback(
            destPath,
            { ...frontmatter, root: false },
            body,
          ),
        };
      },
    })),
  );
}

export async function importFromTrae(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(TRAE_TARGET, projectRoot, scope);

  await importRoot(projectRoot, results, normalize, scope);
  await importNonRootRules(projectRoot, results, normalize, scope);
  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));
  await importEmbeddedSkills(
    projectRoot,
    scope === 'global' ? TRAE_GLOBAL_SKILLS_DIR : TRAE_SKILLS_DIR,
    TRAE_TARGET,
    results,
    normalize,
  );

  return results;
}
