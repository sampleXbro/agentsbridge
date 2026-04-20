/**
 * Cline target importer: .clinerules (rules + workflows), .clineignore,
 * .cline/cline_mcp_settings.json, .cline/skills into canonical .agentsmesh/.
 * Cline rules may have no frontmatter; add root: true for _root.md on import.
 * Workflows (.clinerules/workflows/*.md) import as canonical commands.
 * AGENTS.md is used as a root fallback when no _root.md is found in .clinerules/.
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { mapClineWorkflowFile } from './importer-mappers.js';
import { importClineRules } from './importer-rules.js';
import {
  CLINE_TARGET,
  CLINE_IGNORE,
  CLINE_WORKFLOWS_DIR,
  CLINE_CANONICAL_COMMANDS_DIR,
  CLINE_CANONICAL_IGNORE,
} from './constants.js';
import { importClineMcp } from './mcp-mapper.js';
import { importClineSkills } from './skills-adapter.js';

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
  const clineRulesIsFile = await importClineRules(projectRoot, results, normalize);

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

  const destCommandsDir = join(projectRoot, CLINE_CANONICAL_COMMANDS_DIR);
  if (!clineRulesIsFile) {
    results.push(
      ...(await importFileDirectory({
        srcDir: join(projectRoot, CLINE_WORKFLOWS_DIR),
        destDir: destCommandsDir,
        extensions: ['.md'],
        fromTool: 'cline',
        normalize,
        mapEntry: ({ relativePath, normalizeTo }) =>
          mapClineWorkflowFile(relativePath, destCommandsDir, normalizeTo),
      })),
    );
  }

  await importClineSkills(projectRoot, results, normalize);

  return results;
}
