import { basename, join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import {
  serializeImportedRuleWithFallback,
  serializeImportedCommandWithFallback,
} from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import {
  ANTIGRAVITY_TARGET,
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_ROOT_LEGACY,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
  ANTIGRAVITY_SKILLS_DIR,
  ANTIGRAVITY_CANONICAL_ROOT_RULE,
  ANTIGRAVITY_CANONICAL_RULES_DIR,
  ANTIGRAVITY_CANONICAL_COMMANDS_DIR,
} from './constants.js';

async function importRootRule(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const primary = join(projectRoot, ANTIGRAVITY_RULES_ROOT);
  const legacy = join(projectRoot, ANTIGRAVITY_RULES_ROOT_LEGACY);
  let srcPath = primary;
  let content = await readFileSafe(primary);
  if (content === null) {
    srcPath = legacy;
    content = await readFileSafe(legacy);
  }
  if (content === null) return;

  const destPath = join(projectRoot, ANTIGRAVITY_CANONICAL_ROOT_RULE);
  const { body } = parseFrontmatter(normalize(content, srcPath, destPath));
  const output = await serializeImportedRuleWithFallback(destPath, { root: true }, body);
  await mkdirp(join(projectRoot, ANTIGRAVITY_CANONICAL_RULES_DIR));
  await writeFileAtomic(destPath, output);
  results.push({
    fromTool: ANTIGRAVITY_TARGET,
    fromPath: srcPath,
    toPath: ANTIGRAVITY_CANONICAL_ROOT_RULE,
    feature: 'rules',
  });
}

async function importNonRootRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const srcDir = join(projectRoot, ANTIGRAVITY_RULES_DIR);
  const destDir = join(projectRoot, ANTIGRAVITY_CANONICAL_RULES_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: ANTIGRAVITY_TARGET,
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
        if (basename(relativePath) === 'general.md' || basename(relativePath) === '_root.md')
          return null;
        const destPath = join(destDir, relativePath);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        const output = await serializeImportedRuleWithFallback(
          destPath,
          {
            root: false,
            description:
              typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
            globs: Array.isArray(frontmatter.globs) ? frontmatter.globs : undefined,
          },
          body,
        );
        return {
          destPath,
          toPath: `${ANTIGRAVITY_CANONICAL_RULES_DIR}/${relativePath}`,
          feature: 'rules',
          content: output,
        };
      },
    })),
  );
}

async function importWorkflows(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const srcDir = join(projectRoot, ANTIGRAVITY_WORKFLOWS_DIR);
  const destDir = join(projectRoot, ANTIGRAVITY_CANONICAL_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: ANTIGRAVITY_TARGET,
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
        const destPath = join(destDir, relativePath);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        const normalized = await serializeImportedCommandWithFallback(
          destPath,
          {
            hasDescription: typeof frontmatter.description === 'string',
            description:
              typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
            hasAllowedTools: false,
            allowedTools: [],
          },
          body,
        );
        return {
          destPath,
          toPath: `${ANTIGRAVITY_CANONICAL_COMMANDS_DIR}/${relativePath}`,
          feature: 'commands',
          content: normalized,
        };
      },
    })),
  );
}

export async function importFromAntigravity(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(ANTIGRAVITY_TARGET, projectRoot);
  await importRootRule(projectRoot, results, normalize);
  await importNonRootRules(projectRoot, results, normalize);
  await importWorkflows(projectRoot, results, normalize);
  await importEmbeddedSkills(
    projectRoot,
    ANTIGRAVITY_SKILLS_DIR,
    ANTIGRAVITY_TARGET,
    results,
    normalize,
  );
  return results;
}
