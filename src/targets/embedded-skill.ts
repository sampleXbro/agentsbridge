import { readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { CanonicalFiles, ImportResult } from '../core/types.js';
import { mkdirp, readDirRecursive, readFileSafe, writeFileAtomic } from '../utils/fs.js';
import { parseFrontmatter, serializeFrontmatter } from '../utils/markdown.js';

const AB_SKILLS = '.agentsmesh/skills';

export interface EmbeddedSkillOutput {
  path: string;
  content: string;
}

export function generateEmbeddedSkills(
  canonical: CanonicalFiles,
  skillsDir: string,
): EmbeddedSkillOutput[] {
  const outputs: EmbeddedSkillOutput[] = [];
  for (const skill of canonical.skills) {
    const frontmatter: Record<string, unknown> = {
      name: skill.name,
      description: skill.description || undefined,
    };
    if (frontmatter.description === undefined) delete frontmatter.description;
    outputs.push({
      path: `${skillsDir}/${skill.name}/SKILL.md`,
      content: serializeFrontmatter(frontmatter, skill.body.trim() || ''),
    });
    for (const file of skill.supportingFiles) {
      const relativePath = file.relativePath.replace(/\\/g, '/');
      outputs.push({
        path: `${skillsDir}/${skill.name}/${relativePath}`,
        content: file.content,
      });
    }
  }
  return outputs;
}

export async function importEmbeddedSkills(
  projectRoot: string,
  skillsDir: string,
  fromTool: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const entries = await readdir(join(projectRoot, skillsDir), {
    encoding: 'utf8',
    withFileTypes: true,
  }).catch(() => null);
  if (entries === null) return;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sourceSkillDir = join(projectRoot, skillsDir, entry.name);
    const sourceSkillFile = join(sourceSkillDir, 'SKILL.md');
    const sourceSkillContent = await readFileSafe(sourceSkillFile);
    if (sourceSkillContent === null) continue;

    const destinationSkillDir = join(projectRoot, AB_SKILLS, entry.name);
    const destinationSkillFile = join(destinationSkillDir, 'SKILL.md');
    const { frontmatter, body } = parseFrontmatter(
      normalize(sourceSkillContent, sourceSkillFile, destinationSkillFile),
    );
    const canonicalFrontmatter: Record<string, unknown> = {
      name: entry.name,
      description:
        typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
    };
    if (canonicalFrontmatter.description === undefined) delete canonicalFrontmatter.description;
    const output =
      Object.keys(canonicalFrontmatter).length > 0
        ? serializeFrontmatter(canonicalFrontmatter, body.trim() || '')
        : body.trim() || '';
    await mkdirp(destinationSkillDir);
    await writeFileAtomic(destinationSkillFile, output);
    results.push({
      fromTool,
      fromPath: sourceSkillFile,
      toPath: `${AB_SKILLS}/${entry.name}/SKILL.md`,
      feature: 'skills',
    });

    const sourceFiles = await readDirRecursive(sourceSkillDir);
    for (const sourcePath of sourceFiles) {
      if (sourcePath === sourceSkillFile) continue;
      const relativePath = relative(sourceSkillDir, sourcePath).replace(/\\/g, '/');
      const sourceContent = await readFileSafe(sourcePath);
      if (sourceContent === null) continue;
      const destinationPath = join(destinationSkillDir, relativePath);
      await mkdirp(dirname(destinationPath));
      await writeFileAtomic(destinationPath, normalize(sourceContent, sourcePath, destinationPath));
      results.push({
        fromTool,
        fromPath: sourcePath,
        toPath: `${AB_SKILLS}/${entry.name}/${relativePath}`,
        feature: 'skills',
      });
    }
  }
}
