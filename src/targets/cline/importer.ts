/**
 * Cline target importer: .clinerules (rules + workflows), .clineignore,
 * .cline/cline_mcp_settings.json, .cline/skills into canonical .agentsmesh/.
 * Cline rules may have no frontmatter; add root: true for _root.md on import.
 * Workflows (.clinerules/workflows/*.md) import as canonical commands.
 * AGENTS.md is used as a root fallback when no _root.md is found in .clinerules/.
 */

import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import {
  readFileSafe,
  readDirRecursive,
  writeFileAtomic,
  mkdirp,
} from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { mapClineRuleFile, mapClineWorkflowFile } from './importer-mappers.js';
import {
  CLINE_TARGET,
  CLINE_RULES_DIR,
  CLINE_IGNORE,
  CLINE_WORKFLOWS_DIR,
  CLINE_AGENTS_MD,
  CLINE_CANONICAL_RULES_DIR,
  CLINE_CANONICAL_COMMANDS_DIR,
  CLINE_CANONICAL_IGNORE,
} from './constants.js';
import { importClineMcp } from './mcp-mapper.js';
import { importClineSkills } from './skills-helpers.js';

/**
 * Import Cline config into canonical .agentsmesh/.
 * Sources: .clinerules (rules), .clineignore (ignore), .cline/cline_mcp_settings.json (mcp),
 * .cline/skills (skills).
 *
 * @param projectRoot - Project root directory
 * @returns Import results for each imported file
 */
export async function importFromCline(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(CLINE_TARGET, projectRoot);
  const destRulesDir = join(projectRoot, CLINE_CANONICAL_RULES_DIR);
  const clineRulesPath = join(projectRoot, CLINE_RULES_DIR);

  // Check if .clinerules is a flat file rather than a directory
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
    // Skip directory-based rule import; continue with ignore, mcp, skills below
  } else {
    let rootSourcePath: string | null = null;
    const rootPath = join(clineRulesPath, '_root.md');
    const rootContent = await readFileSafe(rootPath);
    if (rootContent === null) {
      // Prefer AGENTS.md as root when present (cline generates root rule there)
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
        mapEntry: async ({ srcPath, normalizeTo }) => {
          if (srcPath === rootSourcePath) return null;
          return mapClineRuleFile(srcPath, destRulesDir, normalizeTo);
        },
      })),
    );
  }

  const ignorePath = join(projectRoot, CLINE_IGNORE);
  const ignoreContent = await readFileSafe(ignorePath);
  if (ignoreContent !== null && ignoreContent.trim()) {
    const lines = ignoreContent.split(/\r?\n/);
    const patterns: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (t && !t.startsWith('#')) patterns.push(t);
    }
    if (patterns.length > 0) {
      await mkdirp(join(projectRoot, '.agentsmesh'));
      const destIgnorePath = join(projectRoot, CLINE_CANONICAL_IGNORE);
      await writeFileAtomic(destIgnorePath, patterns.join('\n'));
      results.push({
        fromTool: 'cline',
        fromPath: ignorePath,
        toPath: CLINE_CANONICAL_IGNORE,
        feature: 'ignore',
      });
    }
  }

  await importClineMcp(projectRoot, results);

  // Only import workflows when .clinerules is a directory (not a flat file).
  // When .clinerules is a flat file, .clinerules/workflows is invalid (ENOTDIR).
  const destCommandsDir = join(projectRoot, CLINE_CANONICAL_COMMANDS_DIR);
  if (!clineRulesIsFile) {
    results.push(
      ...(await importFileDirectory({
        srcDir: join(projectRoot, CLINE_WORKFLOWS_DIR),
        destDir: destCommandsDir,
        extensions: ['.md'],
        fromTool: 'cline',
        normalize,
        mapEntry: ({ srcPath, normalizeTo }) =>
          mapClineWorkflowFile(srcPath, destCommandsDir, normalizeTo),
      })),
    );
  }

  await importClineSkills(projectRoot, results, normalize);

  return results;
}
