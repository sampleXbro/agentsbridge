/**
 * Copilot agents and skills import helpers.
 */

import { join, basename, dirname, relative } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import {
  readFileSafe,
  readDirRecursive,
  writeFileAtomic,
  mkdirp,
} from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import {
  serializeImportedAgentWithFallback,
  serializeImportedSkillWithFallback,
} from '../import/import-metadata.js';
import {
  COPILOT_TARGET,
  COPILOT_AGENTS_DIR,
  COPILOT_SKILLS_DIR,
  COPILOT_CANONICAL_AGENTS_DIR,
  COPILOT_CANONICAL_SKILLS_DIR,
} from './constants.js';

/**
 * Import .github/agents/*.agent.md into canonical .agentsmesh/agents/*.md.
 * Strips .agent suffix; maps mcp-servers → mcpServers for canonical compatibility.
 */
export async function importAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  agentsDirRel: string = COPILOT_AGENTS_DIR,
): Promise<void> {
  const agentsDir = join(projectRoot, agentsDirRel);
  let files: string[];
  try {
    files = await readDirRecursive(agentsDir);
  } catch {
    return;
  }
  const agentFiles = files.filter((f) => f.endsWith('.agent.md'));
  const destDir = join(projectRoot, COPILOT_CANONICAL_AGENTS_DIR);
  for (const srcPath of agentFiles) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    const relativePath = relative(agentsDir, srcPath).replace(/\\/g, '/');
    const relativeMdPath = relativePath.replace(/\.agent\.md$/i, '.md');
    const base = basename(relativeMdPath, '.md');
    const destPath = join(destDir, relativeMdPath);
    await mkdirp(dirname(destPath));
    const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, destPath));
    const outContent = await serializeImportedAgentWithFallback(
      destPath,
      {
        ...frontmatter,
        name: typeof frontmatter.name === 'string' ? frontmatter.name : base,
      },
      body,
    );
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: COPILOT_TARGET,
      fromPath: srcPath,
      toPath: `${COPILOT_CANONICAL_AGENTS_DIR}/${relativeMdPath}`,
      feature: 'agents',
    });
  }
}

export async function importSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  skillsDirRel: string = COPILOT_SKILLS_DIR,
): Promise<void> {
  const skillFiles = await readDirRecursive(join(projectRoot, skillsDirRel)).catch(() => []);
  const skillMdFiles = skillFiles.filter((path) => path.endsWith('/SKILL.md'));
  for (const skillMdPath of skillMdFiles) {
    const content = await readFileSafe(skillMdPath);
    if (!content) continue;
    const skillName = basename(dirname(skillMdPath));
    const destSkillDir = join(projectRoot, COPILOT_CANONICAL_SKILLS_DIR, skillName);
    const allSkillFiles = await readDirRecursive(dirname(skillMdPath));
    for (const absPath of allSkillFiles) {
      const fileContent = await readFileSafe(absPath);
      if (fileContent === null) continue;
      const relPath = absPath.slice(dirname(skillMdPath).length + 1).replace(/\\/g, '/');
      const destPath = join(destSkillDir, relPath);
      await mkdirp(dirname(destPath));
      const normalized = normalize(fileContent, absPath, destPath);
      const parsed = relPath === 'SKILL.md' ? parseFrontmatter(normalized) : null;
      await writeFileAtomic(
        destPath,
        relPath === 'SKILL.md'
          ? await serializeImportedSkillWithFallback(
              destPath,
              { ...(parsed?.frontmatter ?? {}), name: skillName },
              parsed?.body ?? '',
            )
          : normalized,
      );
      results.push({
        fromTool: COPILOT_TARGET,
        fromPath: absPath,
        toPath: `${COPILOT_CANONICAL_SKILLS_DIR}/${skillName}/${relPath}`,
        feature: 'skills',
      });
    }
  }
}
