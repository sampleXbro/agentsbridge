import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import {
  readFileSafe,
  readDirRecursive,
  writeFileAtomic,
  mkdirp,
} from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { mapClineRuleFile } from './importer-mappers.js';
import { CLINE_RULES_DIR, CLINE_AGENTS_MD, CLINE_CANONICAL_RULES_DIR } from './constants.js';

/**
 * Imports Cline rules from `.clinerules` (file or directory) into canonical rules.
 * @returns `true` when `.clinerules` is a flat file (workflows path must be skipped).
 */
export async function importClineRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<boolean> {
  const destRulesDir = join(projectRoot, CLINE_CANONICAL_RULES_DIR);
  const clineRulesPath = join(projectRoot, CLINE_RULES_DIR);

  const clineRulesRaw = join(projectRoot, CLINE_RULES_DIR);
  let clineRulesIsFile = false;
  try {
    const clineRulesStat = await stat(clineRulesRaw);
    clineRulesIsFile = clineRulesStat.isFile();
  } catch {
    // path doesn't exist — fine
  }

  if (clineRulesIsFile) {
    const flatContent = await readFileSafe(clineRulesRaw);
    if (flatContent !== null) {
      await mkdirp(destRulesDir);
      const destPath = join(destRulesDir, '_root.md');
      const { frontmatter, body } = parseFrontmatter(
        normalize(flatContent, clineRulesRaw, destPath),
      );
      const hasRoot = frontmatter.root === true;
      const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
      const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
      await writeFileAtomic(destPath, outContent);
      results.push({
        fromTool: 'cline',
        fromPath: clineRulesRaw,
        toPath: `${CLINE_CANONICAL_RULES_DIR}/_root.md`,
        feature: 'rules',
      });
    }
    return clineRulesIsFile;
  }

  let rootSourcePath: string | null = null;
  const rootPath = join(clineRulesPath, '_root.md');
  const rootContent = await readFileSafe(rootPath);
  if (rootContent === null) {
    const agentsMdPath = join(projectRoot, CLINE_AGENTS_MD);
    const agentsMdContent = await readFileSafe(agentsMdPath);
    if (agentsMdContent !== null) {
      rootSourcePath = agentsMdPath;
      await mkdirp(destRulesDir);
      const destPath = join(destRulesDir, '_root.md');
      const { frontmatter, body } = parseFrontmatter(
        normalize(agentsMdContent, agentsMdPath, destPath),
      );
      const hasRoot = frontmatter.root === true;
      const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
      const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
      await writeFileAtomic(destPath, outContent);
      results.push({
        fromTool: 'cline',
        fromPath: agentsMdPath,
        toPath: `${CLINE_CANONICAL_RULES_DIR}/_root.md`,
        feature: 'rules',
      });
    } else {
      const ruleFiles = await readDirRecursive(clineRulesPath);
      const mdFiles = ruleFiles
        .filter((f) => f.endsWith('.md') && !f.includes('/workflows/'))
        .sort();
      const first = mdFiles[0];
      if (first) {
        const fc = await readFileSafe(first);
        if (fc !== null) {
          rootSourcePath = first;
          await mkdirp(destRulesDir);
          const destPath = join(destRulesDir, '_root.md');
          const { frontmatter, body } = parseFrontmatter(normalize(fc, first, destPath));
          const hasRoot = frontmatter.root === true;
          const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
          const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
          await writeFileAtomic(destPath, outContent);
          results.push({
            fromTool: 'cline',
            fromPath: first,
            toPath: `${CLINE_CANONICAL_RULES_DIR}/_root.md`,
            feature: 'rules',
          });
        }
      }
    }
  } else {
    rootSourcePath = rootPath;
    await mkdirp(destRulesDir);
    const destPath = join(destRulesDir, '_root.md');
    const { frontmatter, body } = parseFrontmatter(normalize(rootContent, rootPath, destPath));
    const hasRoot = frontmatter.root === true;
    const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
    const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: 'cline',
      fromPath: rootPath,
      toPath: `${CLINE_CANONICAL_RULES_DIR}/_root.md`,
      feature: 'rules',
    });
  }

  results.push(
    ...(await importFileDirectory({
      srcDir: clineRulesPath,
      destDir: destRulesDir,
      extensions: ['.md'],
      fromTool: 'cline',
      normalize,
      mapEntry: async ({ srcPath, relativePath, normalizeTo }) => {
        if (srcPath === rootSourcePath) return null;
        return mapClineRuleFile(relativePath, destRulesDir, normalizeTo);
      },
    })),
  );

  return clineRulesIsFile;
}
