import { basename, dirname, join, relative } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import {
  readFileSafe,
  readDirRecursive,
  writeFileAtomic,
  mkdirp,
} from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedSkillWithFallback } from '../import/import-metadata.js';
import { CLAUDE_SKILLS_DIR, CLAUDE_CANONICAL_SKILLS_DIR } from './constants.js';

export async function importClaudeSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const skillsBaseDir = join(projectRoot, CLAUDE_SKILLS_DIR);
  const destBase = join(projectRoot, CLAUDE_CANONICAL_SKILLS_DIR);

  const allFiles = await readDirRecursive(skillsBaseDir);
  const skillMdFiles = allFiles.filter((f) => f.endsWith('SKILL.md'));

  for (const skillMdPath of skillMdFiles) {
    const skillDir = dirname(skillMdPath);
    const skillName = basename(skillDir);
    const destSkillDir = join(destBase, skillName);

    const skillFiles = await readDirRecursive(skillDir);
    for (const filePath of skillFiles) {
      const fileContent = await readFileSafe(filePath);
      if (fileContent === null) continue;
      const relPath = relative(skillDir, filePath);
      const destPath = join(destSkillDir, relPath);
      await mkdirp(dirname(destPath));
      const normalized = normalize(fileContent, filePath, destPath);
      const parsed = relPath === 'SKILL.md' ? parseFrontmatter(normalized) : null;
      await writeFileAtomic(
        destPath,
        relPath === 'SKILL.md'
          ? await serializeImportedSkillWithFallback(
              destPath,
              parsed?.frontmatter ?? {},
              parsed?.body ?? '',
            )
          : normalized,
      );
      const toPath = `${CLAUDE_CANONICAL_SKILLS_DIR}/${skillName}/${relPath}`;
      results.push({
        fromTool: 'claude-code',
        fromPath: filePath,
        toPath,
        feature: 'skills',
      });
    }
  }
}
