import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import {
  importRooCommands,
  importRooIgnore,
  importRooMcp,
} from './importer-commands-mcp-ignore.js';
import {
  ROO_CODE_TARGET,
  ROO_CODE_DIR,
  ROO_CODE_ROOT_RULE,
  ROO_CODE_ROOT_RULE_FALLBACK,
  ROO_CODE_RULES_DIR,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_GLOBAL_AGENTS_MD,
  ROO_CODE_CANONICAL_ROOT_RULE,
  ROO_CODE_CANONICAL_RULES_DIR,
} from './constants.js';

async function importRootRule(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  scope: TargetLayoutScope,
): Promise<void> {
  const destPath = join(projectRoot, ROO_CODE_CANONICAL_ROOT_RULE);
  const sources =
    scope === 'global'
      ? [ROO_CODE_GLOBAL_AGENTS_MD, ROO_CODE_ROOT_RULE, ROO_CODE_ROOT_RULE_FALLBACK]
      : [ROO_CODE_ROOT_RULE, ROO_CODE_ROOT_RULE_FALLBACK];

  for (const relPath of sources) {
    const srcPath = join(projectRoot, relPath);
    const content = await readFileSafe(srcPath);
    if (content === null) continue;
    const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, destPath));
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
      fromTool: ROO_CODE_TARGET,
      fromPath: srcPath,
      toPath: ROO_CODE_CANONICAL_ROOT_RULE,
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
  const srcDir = join(projectRoot, ROO_CODE_RULES_DIR);
  const destDir = join(projectRoot, ROO_CODE_CANONICAL_RULES_DIR);
  const rootRuleName = '00-root.md';

  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: ROO_CODE_TARGET,
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
        if (relativePath === rootRuleName) return null;
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
          toPath: `${ROO_CODE_CANONICAL_RULES_DIR}/${relativePath}`,
          feature: 'rules',
          content: output,
        };
      },
    })),
  );
}

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

  for (const dirName of modeRuleDirs) {
    const srcDir = join(rooDir, dirName);
    const destDir = join(projectRoot, ROO_CODE_CANONICAL_RULES_DIR);
    results.push(
      ...(await importFileDirectory({
        srcDir,
        destDir,
        extensions: ['.md'],
        fromTool: ROO_CODE_TARGET,
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
            toPath: `${ROO_CODE_CANONICAL_RULES_DIR}/${relativePath}`,
            feature: 'rules',
            content: output,
          };
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
  await importRootRule(projectRoot, results, normalize, scope);
  await importNonRootRules(projectRoot, results, normalize);
  await importPerModeRules(projectRoot, results, normalize);
  await importRooCommands(projectRoot, results, normalize);
  await importEmbeddedSkills(projectRoot, ROO_CODE_SKILLS_DIR, ROO_CODE_TARGET, results, normalize);
  await importRooMcp(projectRoot, results, scope);
  await importRooIgnore(projectRoot, results);
  return results;
}
