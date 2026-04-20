import { basename, join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { toGlobsArray } from '../import/shared-import-helpers.js';
import { readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import {
  KIRO_TARGET,
  KIRO_AGENTS_MD,
  KIRO_GLOBAL_STEERING_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_CANONICAL_ROOT_RULE,
  KIRO_CANONICAL_RULES_DIR,
} from './constants.js';
import {
  importKiroAgents,
  importKiroHooks,
  importKiroIgnore,
  importKiroMcp,
} from './importer-agents-mcp-hooks-ignore.js';

function canonicalRuleMeta(frontmatter: Record<string, unknown>): Record<string, unknown> {
  const inclusion = typeof frontmatter.inclusion === 'string' ? frontmatter.inclusion : '';
  const meta: Record<string, unknown> = {
    root: false,
    description: typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
    globs: toGlobsArray(frontmatter.fileMatchPattern),
  };
  if (inclusion === 'manual') meta.trigger = 'manual';
  if (inclusion === 'auto') meta.trigger = 'model_decision';
  if (inclusion === 'fileMatch') meta.trigger = 'glob';
  return meta;
}

async function importRoot(
  projectRoot: string,
  results: ImportResult[],
  normalize: ReturnType<typeof createImportReferenceNormalizer> extends Promise<infer T>
    ? T
    : never,
  scope: TargetLayoutScope,
): Promise<void> {
  const candidates =
    scope === 'global'
      ? [KIRO_GLOBAL_STEERING_AGENTS_MD, KIRO_AGENTS_MD]
      : [KIRO_AGENTS_MD, KIRO_GLOBAL_STEERING_AGENTS_MD];

  for (const rel of candidates) {
    const srcPath = join(projectRoot, rel);
    const content = await readFileSafe(srcPath);
    if (content === null) continue;
    const destPath = join(projectRoot, KIRO_CANONICAL_ROOT_RULE);
    const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, destPath));
    await writeFileAtomic(
      destPath,
      await serializeImportedRuleWithFallback(destPath, { ...frontmatter, root: true }, body),
    );
    results.push({
      fromTool: KIRO_TARGET,
      fromPath: srcPath,
      toPath: KIRO_CANONICAL_ROOT_RULE,
      feature: 'rules',
    });
    return;
  }
}

async function importRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: ReturnType<typeof createImportReferenceNormalizer> extends Promise<infer T>
    ? T
    : never,
): Promise<void> {
  results.push(
    ...(await importFileDirectory({
      srcDir: join(projectRoot, KIRO_STEERING_DIR),
      destDir: join(projectRoot, KIRO_CANONICAL_RULES_DIR),
      extensions: ['.md'],
      fromTool: KIRO_TARGET,
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
        if (basename(relativePath) === 'AGENTS.md') return null;
        const destPath = join(projectRoot, KIRO_CANONICAL_RULES_DIR, relativePath);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        return {
          destPath,
          toPath: `${KIRO_CANONICAL_RULES_DIR}/${relativePath}`,
          feature: 'rules',
          content: await serializeImportedRuleWithFallback(
            destPath,
            canonicalRuleMeta(frontmatter),
            body,
          ),
        };
      },
    })),
  );
}

export async function importFromKiro(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(KIRO_TARGET, projectRoot, scope);
  await importRoot(projectRoot, results, normalize, scope);
  await importRules(projectRoot, results, normalize);
  await importKiroAgents(projectRoot, results, normalize);
  await importEmbeddedSkills(projectRoot, KIRO_SKILLS_DIR, KIRO_TARGET, results, normalize);
  await importKiroMcp(projectRoot, results, scope);
  await importKiroHooks(projectRoot, results);
  await importKiroIgnore(projectRoot, results, scope);
  return results;
}
