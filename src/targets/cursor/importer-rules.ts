import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { mapCursorRuleFile } from './importer-mappers.js';
import {
  CURSOR_COMPAT_AGENTS,
  CURSOR_LEGACY_RULES,
  CURSOR_RULES_DIR,
  CURSOR_CANONICAL_RULES_DIR,
} from './constants.js';

export async function importCursorRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const destDir = join(projectRoot, CURSOR_CANONICAL_RULES_DIR);
  let rootWritten = false;

  const rulesDir = join(projectRoot, CURSOR_RULES_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: rulesDir,
      destDir,
      extensions: ['.mdc'],
      fromTool: 'cursor',
      normalize,
      mapEntry: async ({ srcPath, relativePath, normalizeTo }) => {
        if (rootWritten) {
          const raw = await readFileSafe(srcPath);
          if (raw !== null) {
            const { frontmatter } = parseFrontmatter(raw);
            if (frontmatter.alwaysApply === true) return null;
          }
        }
        return mapCursorRuleFile(relativePath, destDir, normalizeTo, () => {
          rootWritten = true;
        });
      },
    })),
  );

  if (!rootWritten) {
    const agentsPath = join(projectRoot, CURSOR_COMPAT_AGENTS);
    const agentsContent = await readFileSafe(agentsPath);
    if (agentsContent !== null) {
      rootWritten = true;
      await mkdirp(destDir);
      const destPath = join(destDir, '_root.md');
      const { frontmatter, body } = parseFrontmatter(
        normalize(agentsContent, agentsPath, destPath),
      );
      const hasRoot = frontmatter.root === true;
      const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
      const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
      await writeFileAtomic(destPath, outContent);
      results.push({
        fromTool: 'cursor',
        fromPath: agentsPath,
        toPath: `${CURSOR_CANONICAL_RULES_DIR}/_root.md`,
        feature: 'rules',
      });
    }
  }

  if (!rootWritten) {
    const cursorRulesPath = join(projectRoot, CURSOR_LEGACY_RULES);
    const cursorRulesContent = await readFileSafe(cursorRulesPath);
    if (cursorRulesContent !== null) {
      await mkdirp(destDir);
      const destPath = join(destDir, '_root.md');
      const { frontmatter, body } = parseFrontmatter(
        normalize(cursorRulesContent, cursorRulesPath, destPath),
      );
      const outFm = { ...frontmatter, root: true };
      const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
      await writeFileAtomic(destPath, outContent);
      results.push({
        fromTool: 'cursor',
        fromPath: cursorRulesPath,
        toPath: `${CURSOR_CANONICAL_RULES_DIR}/_root.md`,
        feature: 'rules',
      });
    }
  }
}
