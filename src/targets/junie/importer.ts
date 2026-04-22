import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { splitEmbeddedRulesToCanonical } from '../import/embedded-rules.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import {
  JUNIE_TARGET,
  JUNIE_AGENTS_FALLBACK,
  JUNIE_DOT_AGENTS,
  JUNIE_CI_GUIDELINES,
  JUNIE_GUIDELINES,
  JUNIE_RULES_DIR,
  JUNIE_SKILLS_DIR,
  JUNIE_CANONICAL_ROOT_RULE,
  JUNIE_CANONICAL_RULES_DIR,
} from './constants.js';
import {
  importJunieAgents,
  importJunieCommands,
  importJunieIgnore,
  importJunieMcp,
} from './importer-commands-agents-mcp-ignore.js';

async function importRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const sources = [JUNIE_DOT_AGENTS, JUNIE_GUIDELINES, JUNIE_CI_GUIDELINES, JUNIE_AGENTS_FALLBACK];
  const destPath = join(projectRoot, JUNIE_CANONICAL_ROOT_RULE);

  for (const relPath of sources) {
    const srcPath = join(projectRoot, relPath);
    const content = await readFileSafe(srcPath);
    if (content === null) continue;
    const split = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: JUNIE_CANONICAL_RULES_DIR,
      sourcePath: srcPath,
      fromTool: JUNIE_TARGET,
      normalize,
    });
    results.push(...split.results);
    const { frontmatter, body } = parseFrontmatter(normalize(split.rootContent, srcPath, destPath));
    const output = await serializeImportedRuleWithFallback(
      destPath,
      {
        root: true,
        description:
          typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
        globs: Array.isArray(frontmatter.globs) ? frontmatter.globs : undefined,
      },
      body,
    );
    await writeFileAtomic(destPath, output);
    results.push({
      fromTool: JUNIE_TARGET,
      fromPath: srcPath,
      toPath: JUNIE_CANONICAL_ROOT_RULE,
      feature: 'rules',
    });
    return;
  }
}

async function importNonRootRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const srcDir = join(projectRoot, JUNIE_RULES_DIR);
  const destDir = join(projectRoot, JUNIE_CANONICAL_RULES_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'junie',
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
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
          toPath: `${JUNIE_CANONICAL_RULES_DIR}/${relativePath}`,
          feature: 'rules',
          content: output,
        };
      },
    })),
  );
}

export async function importFromJunie(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(JUNIE_TARGET, projectRoot);
  await importRules(projectRoot, results, normalize);
  await importNonRootRules(projectRoot, results, normalize);
  await importJunieCommands(projectRoot, results, normalize);
  await importJunieAgents(projectRoot, results, normalize);
  await importEmbeddedSkills(projectRoot, JUNIE_SKILLS_DIR, JUNIE_TARGET, results, normalize);
  await importJunieMcp(projectRoot, results);
  await importJunieIgnore(projectRoot, results);
  return results;
}
