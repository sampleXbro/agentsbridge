/**
 * Gemini CLI format helpers — flexible frontmatter parsing, hook event mapping,
 * and settings processing (MCP, ignore, hooks).
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { GEMINI_IGNORE, GEMINI_CANONICAL_IGNORE } from './constants.js';

export { mapGeminiHookEvent, parseFlexibleFrontmatter } from './format-helpers-shared.js';
export { importGeminiSettings } from './format-helpers-settings.js';

export async function importGeminiIgnore(
  projectRoot: string,
  results: ImportResult[],
): Promise<void> {
  const geminiIgnorePath = join(projectRoot, GEMINI_IGNORE);
  const geminiIgnoreContent = await readFileSafe(geminiIgnorePath);
  if (geminiIgnoreContent !== null && geminiIgnoreContent.trim()) {
    const patterns = geminiIgnoreContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    if (patterns.length > 0) {
      await mkdirp(join(projectRoot, '.agentsmesh'));
      const ignorePath = join(projectRoot, GEMINI_CANONICAL_IGNORE);
      await writeFileAtomic(ignorePath, patterns.join('\n') + '\n');
      results.push({
        fromTool: 'gemini-cli',
        fromPath: geminiIgnorePath,
        toPath: GEMINI_CANONICAL_IGNORE,
        feature: 'ignore',
      });
    }
  }
}
